import type { FrameMetrics } from '@/scanner/frameAnalysis';
import { type Frame, type IdentifyAttempt, LiveScanController, type LiveScanDeps, type LiveScanView } from '@/scanner/liveScanner';
import type { Box } from '@/scanner/tracking';

const CAR: Box = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 };
const SHARP: FrameMetrics = { sharpness: 200, luma: 120, hash: '0f0f0f0f0f0f0f0f' };

/** A fake camera and clock. Timers run only when the test calls `flush`. */
function harness(opts: {
  boxes?: () => Box[];
  metrics?: () => FrameMetrics;
  identify?: (frame: Frame) => Promise<IdentifyAttempt<string>>;
  capture?: () => Promise<Frame | null>;
}) {
  let now = 0;
  let n = 0;
  const timers: { fn: () => void; at: number }[] = [];
  const discarded: string[] = [];
  const identified: string[] = [];
  const views: LiveScanView<string>[] = [];
  const deps: LiveScanDeps<string> = {
    capture: opts.capture ?? (async () => ({ uri: `frame-${++n}`, width: 1000, height: 750 })),
    propose: async () => (opts.boxes ? opts.boxes() : [CAR]),
    measure: async () => (opts.metrics ? opts.metrics() : SHARP),
    identify: async (frame, _t, _signal) => {
      identified.push(frame.uri);
      return opts.identify ? opts.identify(frame) : { kind: 'outcome', outcome: 'identified', payload: 'Mazda MX-5 (NA)' };
    },
    discard: (f) => discarded.push(f.uri),
    now: () => now,
    schedule: (fn, ms) => {
      const t = { fn, at: now + ms };
      timers.push(t);
      return () => {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
      };
    },
  };
  const ctrl = new LiveScanController(deps, (v) => views.push(v));
  /** Runs timers one at a time, advancing the clock, until none are due within `ms`. */
  async function flush(ms: number) {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      now = t.at;
      t.fn();
      // Let the async tick settle.
      for (let i = 0; i < 20; i++) await Promise.resolve();
    }
    now = end;
  }
  return { ctrl, flush, discarded, identified, views, pending: () => timers.length };
}

describe('LiveScanController', () => {
  it('identifies a steady, sharp target automatically, deletes unused frames and stops on a result', async () => {
    const h = harness({});
    h.ctrl.start();
    await h.flush(5000);
    expect(h.identified).toEqual(['frame-2']);
    expect(h.discarded).toEqual(['frame-1']);
    expect(h.ctrl.current).toMatchObject({ status: 'found', found: 'Mazda MX-5 (NA)' });
    expect(h.pending()).toBe(0);
  });

  it('never calls the cloud while the frame is blurred, and deletes every frame', async () => {
    const h = harness({ metrics: () => ({ ...SHARP, sharpness: 5 }) });
    h.ctrl.start();
    await h.flush(20_000);
    expect(h.identified).toEqual([]);
    expect(h.ctrl.current.hint).toBe('blurred');
    expect(h.discarded.length).toBeGreaterThan(10);
  });

  it('pauses after a long time with nothing in view', async () => {
    const h = harness({ boxes: () => [] });
    h.ctrl.start();
    await h.flush(60_000);
    expect(h.ctrl.current).toMatchObject({ status: 'paused', pausedBy: 'idle' });
    expect(h.pending()).toBe(0);
    expect(h.identified).toEqual([]);
  });

  it('keeps scanning after "no vehicle", with a backoff and a notice', async () => {
    let calls = 0;
    const h = harness({
      identify: async () => (++calls === 1 ? { kind: 'outcome', outcome: 'no_vehicle', payload: null } : { kind: 'outcome', outcome: 'identified', payload: 'BMW E30' }),
      metrics: () => ({ ...SHARP, hash: calls === 0 ? '0f0f0f0f0f0f0f0f' : 'f0f0f0f0f0f0f0f0' }),
    });
    h.ctrl.start();
    await h.flush(1500);
    expect(h.ctrl.current).toMatchObject({ status: 'scanning', notice: 'no_vehicle' });
    await h.flush(20_000);
    expect(h.identified).toHaveLength(2);
    expect(h.ctrl.current).toMatchObject({ status: 'found', found: 'BMW E30' });
  });

  it('stops when identification is blocked and resumes only on restart', async () => {
    const h = harness({ identify: async () => ({ kind: 'blocked', reason: 'no_redaction' }) });
    h.ctrl.start();
    await h.flush(5000);
    expect(h.ctrl.current).toMatchObject({ status: 'blocked', blockedReason: 'no_redaction' });
    h.ctrl.start();
    expect(h.ctrl.current.status).toBe('blocked');
    h.ctrl.restart();
    expect(h.ctrl.current.status).toBe('scanning');
  });

  it('cancels an upload in flight when stopped and ignores its late answer', async () => {
    let release!: (a: IdentifyAttempt<string>) => void;
    let seenSignal: AbortSignal | null = null;
    const h = harness({});
    // Replace identify with one we control.
    const deps = (h.ctrl as unknown as { deps: LiveScanDeps<string> }).deps;
    deps.identify = (_f, _t, signal) => {
      seenSignal = signal;
      return new Promise((r) => (release = r));
    };
    h.ctrl.start();
    await h.flush(2000);
    expect(h.ctrl.current.status).toBe('identifying');
    h.ctrl.stop();
    expect(seenSignal!.aborted).toBe(true);
    release({ kind: 'outcome', outcome: 'identified', payload: 'late' });
    await h.flush(10);
    expect(h.ctrl.current).toMatchObject({ status: 'paused', found: null });
  });

  it('stops after repeated camera failures instead of retrying forever', async () => {
    const h = harness({ capture: async () => Promise.reject(new Error('camera busy')) });
    h.ctrl.start();
    await h.flush(30_000);
    expect(h.ctrl.current).toMatchObject({ status: 'blocked', blockedReason: 'camera' });
    expect(h.pending()).toBe(0);
  });

  it('respects the per-session cap across many views', async () => {
    let i = 0;
    const h = harness({
      identify: async () => ({ kind: 'outcome', outcome: 'no_vehicle', payload: null }),
      // A new view every two frames.
      metrics: () => ({ ...SHARP, hash: (Math.floor(i++ / 2) * 0x9e3779b1).toString(16).padStart(16, '0').slice(-16) }),
    });
    h.ctrl.start();
    await h.flush(600_000);
    expect(h.identified.length).toBeLessThanOrEqual(12);
    expect(h.ctrl.current).toMatchObject({ status: 'paused', pausedBy: 'session_limit' });
    h.ctrl.start();
    expect(h.ctrl.current.status).toBe('paused');
  });
});

describe('LiveScanController.dismiss', () => {
  it('clears a result without starting, and the next start scans again', async () => {
    const { LiveScanController: C } = jest.requireActual('@/scanner/liveScanner') as typeof import('@/scanner/liveScanner');
    let scheduled = 0;
    const ctrl = new C<string>(
      {
        capture: async () => null,
        propose: async () => [],
        measure: async () => SHARP,
        identify: async () => ({ kind: 'blocked', reason: 'x' }),
        discard: () => undefined,
        now: () => 0,
        schedule: () => {
          scheduled++;
          return () => undefined;
        },
      },
      () => undefined,
    );
    ctrl.dismiss();
    expect(ctrl.current.status).toBe('paused');
    expect(scheduled).toBe(0);
    ctrl.start();
    expect(ctrl.current.status).toBe('scanning');
    expect(scheduled).toBe(1);
  });
});
