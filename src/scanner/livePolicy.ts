import { hammingDistance, type FrameMetrics } from './frameAnalysis';
import { area, type Box, iou, selectTarget } from './tracking';

/**
 * Decision policy for automatic live scanning.
 *
 * The camera is sampled a few times a second; each sample is measured on the
 * device (object boxes, sharpness, exposure, a perceptual hash). Only a frame
 * that passes every gate is sent for cloud identification, and the cloud is
 * further limited by a cooldown, a per-session cap and near-duplicate
 * suppression. This module is pure: the caller supplies the clock.
 */
export interface LiveScanConfig {
  /** Delay between samples while something is in view. */
  activeIntervalMs: number;
  /** Delay between samples while nothing usable is in view (saves battery). */
  idleIntervalMs: number;
  /** Pause sampling entirely after this long without a usable target. */
  idlePauseMs: number;
  /** Minimum share of the frame the target must fill. */
  minTargetArea: number;
  /** Consecutive frames the target must hold still (IoU ≥ minStableIou) before sending. */
  stableFrames: number;
  minStableIou: number;
  /** Two consecutive frames whose perceptual hashes differ by more than this are treated as camera movement. */
  maxMotionHamming: number;
  /** Laplacian variance below this is treated as blurred. */
  minSharpness: number;
  minLuma: number;
  maxLuma: number;
  /** Minimum time between two cloud identifications. */
  cloudCooldownMs: number;
  /** Cloud identifications allowed per scanner session (the daily allowance applies separately). */
  sessionCloudCap: number;
  /** A frame within this Hamming distance of a recent sent frame is not sent again… */
  duplicateHamming: number;
  /** …for this long. */
  duplicateWindowMs: number;
  /** After "no vehicle" or an uncertain answer, wait this long before trying again. */
  retryBackoffMs: number;
}

export const DEFAULT_LIVE_SCAN_CONFIG: LiveScanConfig = {
  activeIntervalMs: 700,
  idleIntervalMs: 1800,
  idlePauseMs: 45_000,
  minTargetArea: 0.08,
  stableFrames: 2,
  minStableIou: 0.55,
  maxMotionHamming: 14,
  minSharpness: 40,
  minLuma: 35,
  maxLuma: 225,
  cloudCooldownMs: 4000,
  sessionCloudCap: 12,
  duplicateHamming: 10,
  duplicateWindowMs: 120_000,
  retryBackoffMs: 6000,
};

export interface FrameObservation {
  /** Candidate objects from on-device detection, normalised. Empty when nothing was found. */
  boxes: Box[];
  metrics: FrameMetrics;
}

/** Why the scanner is not sending the current frame; shown to the player as guidance. */
export type Hint =
  | 'searching'
  | 'too_far'
  | 'hold_steady'
  | 'too_dark'
  | 'too_bright'
  | 'blurred'
  | 'already_checked'
  | 'cooldown'
  | 'session_limit'
  | 'ready';

export interface LiveScanState {
  target: Box | null;
  stableCount: number;
  /** Hash of the previous sharp, well-exposed frame, used to detect camera movement. */
  lastHash: string | null;
  lastUsefulAt: number;
  lastCloudAt: number | null;
  cloudCalls: number;
  recentHashes: { hash: string; at: number }[];
  backoffUntil: number;
  paused: boolean;
  hint: Hint;
}

export type Decision =
  | { kind: 'wait'; delayMs: number; hint: Hint }
  | { kind: 'identify'; target: Box; hash: string }
  | { kind: 'pause' };

export function initialLiveScanState(now: number): LiveScanState {
  return {
    target: null,
    stableCount: 0,
    lastHash: null,
    lastUsefulAt: now,
    lastCloudAt: null,
    cloudCalls: 0,
    recentHashes: [],
    backoffUntil: 0,
    paused: false,
    hint: 'searching',
  };
}

function wait(state: LiveScanState, hint: Hint, delayMs: number): [LiveScanState, Decision] {
  return [{ ...state, hint }, { kind: 'wait', delayMs, hint }];
}

/** Processes one sampled frame and decides whether to identify it. */
export function decide(
  prev: LiveScanState,
  obs: FrameObservation | null,
  now: number,
  cfg: LiveScanConfig = DEFAULT_LIVE_SCAN_CONFIG,
): [LiveScanState, Decision] {
  if (prev.paused) return [prev, { kind: 'pause' }];
  const recentHashes = prev.recentHashes.filter((h) => now - h.at < cfg.duplicateWindowMs);
  let state: LiveScanState = { ...prev, recentHashes };

  if (state.cloudCalls >= cfg.sessionCloudCap) {
    return [{ ...state, paused: true, hint: 'session_limit' }, { kind: 'pause' }];
  }

  const target = obs ? selectTarget(obs.boxes.filter((b) => area(b) > 0), state.target) : null;
  if (!obs || !target) {
    if (now - state.lastUsefulAt >= cfg.idlePauseMs) return [{ ...state, paused: true, target: null, stableCount: 0 }, { kind: 'pause' }];
    return wait({ ...state, target: null, stableCount: 0 }, 'searching', cfg.idleIntervalMs);
  }
  if (area(target) < cfg.minTargetArea) {
    if (now - state.lastUsefulAt >= cfg.idlePauseMs) return [{ ...state, paused: true, target: null, stableCount: 0 }, { kind: 'pause' }];
    return wait({ ...state, target, stableCount: 0 }, 'too_far', cfg.idleIntervalMs);
  }

  // Something worth looking at is in view.
  state = { ...state, lastUsefulAt: now };
  const m = obs.metrics;
  if (m.luma < cfg.minLuma) return wait({ ...state, target, stableCount: 0 }, 'too_dark', cfg.activeIntervalMs);
  if (m.luma > cfg.maxLuma) return wait({ ...state, target, stableCount: 0 }, 'too_bright', cfg.activeIntervalMs);
  if (m.sharpness < cfg.minSharpness) return wait({ ...state, target, stableCount: 0 }, 'blurred', cfg.activeIntervalMs);

  const boxSteady = state.target != null && iou(target, state.target) >= cfg.minStableIou;
  const viewSteady = state.lastHash == null || hammingDistance(state.lastHash, m.hash) <= cfg.maxMotionHamming;
  const stableCount = boxSteady && viewSteady ? state.stableCount + 1 : 1;
  state = { ...state, target, stableCount, lastHash: m.hash };
  if (stableCount < cfg.stableFrames) return wait(state, 'hold_steady', cfg.activeIntervalMs);

  if (recentHashes.some((h) => hammingDistance(h.hash, m.hash) <= cfg.duplicateHamming)) {
    return wait(state, 'already_checked', cfg.activeIntervalMs);
  }
  if (now < state.backoffUntil) return wait(state, 'already_checked', cfg.activeIntervalMs);
  if (state.lastCloudAt != null && now - state.lastCloudAt < cfg.cloudCooldownMs) {
    return wait(state, 'cooldown', cfg.activeIntervalMs);
  }

  const next: LiveScanState = {
    ...state,
    hint: 'ready',
    lastCloudAt: now,
    cloudCalls: state.cloudCalls + 1,
    recentHashes: [...recentHashes, { hash: m.hash, at: now }].slice(-20),
    stableCount: 0,
  };
  return [next, { kind: 'identify', target, hash: m.hash }];
}

export type IdentifyOutcome = 'identified' | 'uncertain' | 'no_vehicle' | 'error';

/** Applies the result of a cloud identification to the scanner state. */
export function afterIdentify(
  state: LiveScanState,
  outcome: IdentifyOutcome,
  now: number,
  cfg: LiveScanConfig = DEFAULT_LIVE_SCAN_CONFIG,
): LiveScanState {
  if (outcome === 'identified') return { ...state, paused: true };
  return { ...state, backoffUntil: now + cfg.retryBackoffMs, target: null, stableCount: 0, lastHash: null };
}

export function resume(state: LiveScanState, now: number, resetSession = false): LiveScanState {
  return {
    ...state,
    paused: false,
    lastUsefulAt: now,
    target: null,
    stableCount: 0,
    lastHash: null,
    hint: 'searching',
    ...(resetSession ? { cloudCalls: 0 } : {}),
  };
}

export const HINT_TEXT: Record<Hint, string> = {
  searching: 'Point at a car',
  too_far: 'Move closer, or zoom so the car fills the frame',
  hold_steady: 'Hold steady',
  too_dark: 'Too dark to identify',
  too_bright: 'Too much glare',
  blurred: 'Hold steady, the image is blurred',
  already_checked: 'Already checked this view. Try another angle',
  cooldown: 'Analysing…',
  session_limit: 'Scan limit for this session reached',
  ready: 'Identifying…',
};

/** Thresholds for turning a cloud answer into what the player sees. Not calibrated probabilities. */
export const RESULT_THRESHOLDS = { identified: 0.7, plausible: 0.35 } as const;

export function classifyRecognition(
  result: { vehicleDetected: boolean; candidates: { confidence: number }[] },
  catalogMatches: number,
): IdentifyOutcome {
  if (!result.vehicleDetected || result.candidates.length === 0) return 'no_vehicle';
  const top = result.candidates[0]!.confidence;
  if (catalogMatches > 0 && top >= RESULT_THRESHOLDS.identified) return 'identified';
  return top >= RESULT_THRESHOLDS.plausible || catalogMatches > 0 ? 'uncertain' : 'no_vehicle';
}
