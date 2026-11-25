import type { FrameMetrics } from './frameAnalysis';
import {
  afterIdentify,
  decide,
  DEFAULT_LIVE_SCAN_CONFIG,
  type Hint,
  type IdentifyOutcome,
  initialLiveScanState,
  type LiveScanConfig,
  type LiveScanState,
  resume,
} from './livePolicy';
import type { Box } from './tracking';

export interface Frame {
  uri: string;
  width: number;
  height: number;
}

/** What the identify step reports back. `payload` is whatever the screen needs to show a result. */
export type IdentifyAttempt<P> =
  | { kind: 'outcome'; outcome: IdentifyOutcome; payload: P | null }
  /** Scanning cannot continue until the player acts (no consent, allowance used up, privacy protection unavailable). */
  | { kind: 'blocked'; reason: string };

export interface LiveScanDeps<P> {
  /** A silent, low-quality still from the camera, or null when the camera has nothing to give. */
  capture(): Promise<Frame | null>;
  propose(frame: Frame): Promise<Box[]>;
  measure(frame: Frame): Promise<FrameMetrics>;
  /** Redacts on the device, applies consent and allowance checks, calls the cloud. Takes ownership of the frame file. */
  identify(frame: Frame, target: Box, signal: AbortSignal): Promise<IdentifyAttempt<P>>;
  /** Deletes a frame file that was not handed to `identify`. */
  discard(frame: Frame): void;
  now(): number;
  schedule(fn: () => void, ms: number): () => void;
}

export type LiveScanStatus = 'scanning' | 'identifying' | 'found' | 'paused' | 'blocked';

export interface LiveScanView<P> {
  status: LiveScanStatus;
  hint: Hint;
  target: Box | null;
  /** A short message about the last attempt ("No car recognised…"). */
  notice: 'no_vehicle' | 'unsure' | 'error' | null;
  found: P | null;
  /** Set when status is 'blocked'. */
  blockedReason: string | null;
  /** Why scanning paused: idle (nothing in view for a while) or the per-session limit. */
  pausedBy: 'idle' | 'session_limit' | null;
  cloudCalls: number;
  /** Width / height of the last sampled frame, for drawing the target box over the preview. */
  frameAspect: number | null;
}

/** Consecutive camera or analysis failures before scanning stops and asks the player. */
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Runs the live scanning loop: sample a frame, measure it on the device, let
 * the policy decide, and only then identify. One frame is in flight at a time,
 * so a slow phone simply samples less often rather than queueing work.
 */
export class LiveScanController<P> {
  private state: LiveScanState;
  private running = false;
  private inFlight = false;
  private cancelTimer: (() => void) | null = null;
  private abort: AbortController | null = null;
  private errors = 0;
  /** Incremented on every start and stop, so work begun by an earlier run is ignored when it finishes. */
  private generation = 0;
  private view: LiveScanView<P>;

  constructor(
    private readonly deps: LiveScanDeps<P>,
    private readonly onChange: (view: LiveScanView<P>) => void,
    private readonly cfg: LiveScanConfig = DEFAULT_LIVE_SCAN_CONFIG,
  ) {
    this.state = initialLiveScanState(deps.now());
    this.view = {
      status: 'paused',
      hint: 'searching',
      target: null,
      notice: null,
      found: null,
      blockedReason: null,
      pausedBy: null,
      cloudCalls: 0,
      frameAspect: null,
    };
  }

  get current(): LiveScanView<P> {
    return this.view;
  }

  /** Starts sampling (camera visible and app in the foreground). Does nothing while a result is shown. */
  start(): void {
    if (this.running || this.view.status === 'found' || this.view.status === 'blocked') return;
    if (this.view.status === 'paused' && this.view.pausedBy === 'session_limit') return;
    this.running = true;
    this.generation += 1;
    this.state = resume(this.state, this.deps.now());
    this.update({ status: 'scanning', hint: 'searching', target: null, pausedBy: null });
    this.next(0);
  }

  /** Stops sampling and cancels any upload in progress (screen hidden, app backgrounded). */
  stop(): void {
    this.running = false;
    this.generation += 1;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.abort?.abort();
    this.abort = null;
    if (this.view.status === 'scanning' || this.view.status === 'identifying') {
      this.update({ status: 'paused', target: null, pausedBy: null });
    }
  }

  /** Clears a shown result or block without starting; the next `start` scans again. */
  dismiss(): void {
    this.stop();
    this.state = resume(this.state, this.deps.now());
    this.errors = 0;
    this.update({ status: 'paused', found: null, blockedReason: null, notice: null, pausedBy: null });
  }

  /** Clears a shown result or block and scans again. `newSession` also resets the per-session cap. */
  restart(newSession = false): void {
    this.stop();
    this.state = resume(this.state, this.deps.now(), newSession);
    this.errors = 0;
    this.update({ status: 'paused', found: null, blockedReason: null, notice: null, pausedBy: null, cloudCalls: this.state.cloudCalls });
    this.start();
  }

  private update(patch: Partial<LiveScanView<P>>): void {
    this.view = { ...this.view, ...patch };
    this.onChange(this.view);
  }

  private next(ms: number): void {
    if (!this.running) return;
    this.cancelTimer = this.deps.schedule(() => {
      this.cancelTimer = null;
      void this.tick();
    }, ms);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    if (this.inFlight) {
      // An earlier run's frame is still being processed; try again shortly.
      this.next(this.cfg.activeIntervalMs);
      return;
    }
    const gen = this.generation;
    const alive = () => this.running && gen === this.generation;
    this.inFlight = true;
    let frame: Frame | null = null;
    try {
      frame = await this.deps.capture();
      if (!alive()) return;
      let obs = null;
      if (frame) {
        const [boxes, metrics] = await Promise.all([this.deps.propose(frame), this.deps.measure(frame)]);
        obs = { boxes, metrics };
      }
      if (!alive()) return;
      this.errors = 0;
      const [state, decision] = decide(this.state, obs, this.deps.now(), this.cfg);
      this.state = state;
      if (decision.kind === 'pause') {
        this.running = false;
        this.update({
          status: 'paused',
          hint: state.hint,
          target: null,
          pausedBy: state.hint === 'session_limit' ? 'session_limit' : 'idle',
        });
        return;
      }
      if (decision.kind === 'wait') {
        this.update({ hint: decision.hint, target: state.target, ...(frame ? { frameAspect: frame.width / frame.height } : {}) });
        this.next(decision.delayMs);
        return;
      }

      // The policy chose this frame: hand it (and responsibility for deleting it) to identify.
      const chosen = frame!;
      frame = null;
      this.update({
        status: 'identifying',
        hint: 'ready',
        target: decision.target,
        notice: null,
        cloudCalls: state.cloudCalls,
        frameAspect: chosen.width / chosen.height,
      });
      const abort = new AbortController();
      this.abort = abort;
      const attempt = await this.deps.identify(chosen, decision.target, abort.signal);
      if (this.abort === abort) this.abort = null;
      if (!alive() || abort.signal.aborted) return;

      if (attempt.kind === 'blocked') {
        this.running = false;
        this.update({ status: 'blocked', blockedReason: attempt.reason, target: null });
        return;
      }
      // Repeated service errors stop the loop rather than spending allowance on retries.
      this.errors = attempt.outcome === 'error' ? this.errors + 1 : 0;
      if (this.errors >= MAX_CONSECUTIVE_ERRORS) {
        this.running = false;
        this.update({ status: 'blocked', blockedReason: 'service', target: null });
        return;
      }
      const showResult = attempt.payload != null && (attempt.outcome === 'identified' || attempt.outcome === 'uncertain');
      this.state = afterIdentify(this.state, showResult ? 'identified' : attempt.outcome, this.deps.now(), this.cfg);
      if (showResult) {
        this.running = false;
        this.update({ status: 'found', found: attempt.payload, target: null });
        return;
      }
      this.update({
        status: 'scanning',
        target: null,
        notice: attempt.outcome === 'no_vehicle' ? 'no_vehicle' : attempt.outcome === 'error' ? 'error' : 'unsure',
      });
      this.next(this.cfg.activeIntervalMs);
    } catch {
      if (!alive()) return;
      // A camera or measurement failure: back off, and stop asking after a few in a row.
      this.errors += 1;
      if (this.errors >= MAX_CONSECUTIVE_ERRORS) {
        this.running = false;
        this.update({ status: 'blocked', blockedReason: 'camera', target: null });
      } else {
        this.update({ status: 'scanning', notice: 'error', target: null });
        this.next(this.cfg.idleIntervalMs);
      }
    } finally {
      if (frame) this.deps.discard(frame);
      this.inFlight = false;
    }
  }
}
