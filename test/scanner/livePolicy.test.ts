import { differenceHash, hammingDistance, laplacianVariance, metricsFromJpeg, toGray } from '@/scanner/frameAnalysis';
import {
  afterIdentify,
  classifyRecognition,
  decide,
  DEFAULT_LIVE_SCAN_CONFIG as cfg,
  type FrameObservation,
  initialLiveScanState,
  resume,
} from '@/scanner/livePolicy';
import { iou, selectTarget } from '@/scanner/tracking';
import encode from '@/vendor/jpegEncoder';

const car = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 };
const good = (hash = '0f0f0f0f0f0f0f0f', box = car): FrameObservation => ({
  boxes: [box],
  metrics: { sharpness: 200, luma: 120, hash },
});

function run(states: FrameObservation[], start = 0, step = 700) {
  let s = initialLiveScanState(start);
  const decisions = [];
  let t = start;
  for (const o of states) {
    const [n, d] = decide(s, o, t);
    s = n;
    decisions.push(d);
    t += step;
  }
  return { s, decisions };
}

describe('frame analysis', () => {
  const W = 32;
  const H = 24;
  const flat = new Uint8Array(W * H * 4).fill(128);
  const stripes = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) stripes.fill((i % 2) * 255, i * 4, i * 4 + 3), (stripes[i * 4 + 3] = 255);

  it('scores a flat frame as blurred and a detailed one as sharp', () => {
    expect(laplacianVariance(toGray(flat, W, H), W, H)).toBe(0);
    expect(laplacianVariance(toGray(stripes, W, H), W, H)).toBeGreaterThan(1000);
  });

  it('gives near-identical frames near-identical hashes', () => {
    const a = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) a.fill((i % W) * 8, i * 4, i * 4 + 3);
    const b = a.map((v, i) => (i % 4 === 3 ? v : Math.min(255, v + 3)));
    const ha = differenceHash(toGray(a, W, H), W, H);
    const hb = differenceHash(toGray(b, W, H), W, H);
    expect(ha).toHaveLength(16);
    expect(hammingDistance(ha, hb)).toBeLessThanOrEqual(4);
    expect(hammingDistance(ha, differenceHash(toGray(stripes, W, H), W, H))).toBeGreaterThan(10);
  });

  it('measures a real JPEG', () => {
    const jpeg = encode({ data: stripes, width: W, height: H }, 90).data;
    const m = metricsFromJpeg(jpeg);
    expect(m.luma).toBeGreaterThan(60);
    expect(m.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('target selection', () => {
  it('prefers a large central car and keeps tracking it', () => {
    const small = { x: 0, y: 0, width: 0.1, height: 0.1 };
    expect(selectTarget([small, car], null)).toBe(car);
    const nudged = { ...car, x: 0.22 };
    const other = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
    expect(selectTarget([other, nudged], car)).toBe(nudged);
    expect(iou(car, car)).toBeCloseTo(1);
  });
});

describe('live scan policy', () => {
  it('identifies only after the target holds steady', () => {
    const { decisions } = run([good(), good()]);
    expect(decisions[0]).toMatchObject({ kind: 'wait', hint: 'hold_steady' });
    expect(decisions[1]).toMatchObject({ kind: 'identify' });
  });

  it('never sends dark, blurred or distant frames', () => {
    const dark = { ...good(), metrics: { ...good().metrics, luma: 10 } };
    const blurred = { ...good(), metrics: { ...good().metrics, sharpness: 5 } };
    const far = good('0f0f0f0f0f0f0f0f', { x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
    const { decisions } = run([dark, dark, blurred, blurred, far, far]);
    expect(decisions.map((d) => d.kind)).not.toContain('identify');
    expect(decisions[0]).toMatchObject({ hint: 'too_dark' });
    expect(decisions[2]).toMatchObject({ hint: 'blurred' });
    expect(decisions[4]).toMatchObject({ hint: 'too_far' });
  });

  it('suppresses a near-duplicate view and enforces the cooldown', () => {
    let s = initialLiveScanState(0);
    let d;
    [s, d] = decide(s, good(), 0);
    [s, d] = decide(s, good(), 700);
    expect(d.kind).toBe('identify');
    s = afterIdentify(s, 'uncertain', 800);
    // Same view again after the backoff: suppressed as already checked.
    for (const t of [8000, 8700, 9400]) [s, d] = decide(s, good('0f0f0f0f0f0f0f0e'), t);
    expect(d).toMatchObject({ kind: 'wait', hint: 'already_checked' });
    // A genuinely different view is allowed once the cooldown has passed.
    [s, d] = decide(s, good('f0f0f0f0f0f0f0f0'), 10_100);
    expect(d.kind).toBe('identify');
    // And the cooldown blocks an immediate second call even for another new view.
    [s, d] = decide(s, good('00ff00ff00ff00ff'), 10_800);
    [s, d] = decide(s, good('00ff00ff00ff00ff'), 11_500);
    expect(d).toMatchObject({ kind: 'wait', hint: 'cooldown' });
  });

  it('caps cloud calls per session and pauses', () => {
    let s = initialLiveScanState(0);
    let calls = 0;
    let t = 0;
    for (let i = 0; i < 200; i++) {
      const hash = (i * 0x1234567).toString(16).padStart(16, '0').slice(-16);
      const [n, d] = decide(s, good(hash.replace(/./g, (c, j) => (j < 8 ? c : String.fromCharCode(97 + (i % 6))))), t);
      s = n;
      if (d.kind === 'identify') {
        calls++;
        s = afterIdentify(s, 'no_vehicle', t);
      }
      t += 5000;
    }
    expect(calls).toBeLessThanOrEqual(cfg.sessionCloudCap);
    expect(s.paused).toBe(true);
  });

  it('pauses after a long idle period and resumes on request', () => {
    let s = initialLiveScanState(0);
    let d;
    [s, d] = decide(s, { boxes: [], metrics: good().metrics }, cfg.idlePauseMs + 1);
    expect(d.kind).toBe('pause');
    s = resume(s, cfg.idlePauseMs + 2);
    expect(s.paused).toBe(false);
  });

  it('stops after a confident identification', () => {
    const s = afterIdentify(initialLiveScanState(0), 'identified', 0);
    expect(decide(s, good(), 1)[1].kind).toBe('pause');
  });
});

describe('result classification', () => {
  it('separates identified, uncertain and no-vehicle answers', () => {
    expect(classifyRecognition({ vehicleDetected: true, candidates: [{ confidence: 0.9 }] }, 1)).toBe('identified');
    expect(classifyRecognition({ vehicleDetected: true, candidates: [{ confidence: 0.9 }] }, 0)).toBe('uncertain');
    expect(classifyRecognition({ vehicleDetected: true, candidates: [{ confidence: 0.5 }] }, 2)).toBe('uncertain');
    expect(classifyRecognition({ vehicleDetected: false, candidates: [] }, 0)).toBe('no_vehicle');
  });
});
