import type { RedactionSummary } from '@/services/imageService';

import { type PreparedImage, RecognitionError, type RecognitionProvider, type RecognitionResult } from './types';

export type ManualReason = 'unconfigured' | 'no_consent' | 'quota' | 'no_redaction';

export type GatedOutcome =
  | { kind: 'result'; result: RecognitionResult }
  | { kind: 'manual'; reason: ManualReason }
  | { kind: 'aborted' };

export interface RecognitionGates {
  mode: 'remote' | 'mock' | 'unconfigured';
  /** Read at each step, so revoking consent mid-flight always wins. */
  consented(): boolean;
  /** Remaining client-side identifications today. */
  allowance(): Promise<number>;
  noteUsed(): Promise<void>;
  provider(): Promise<RecognitionProvider | null>;
}

/**
 * The single path from a prepared photo to a cloud answer, shared by the live
 * scanner and the identify screen. Every check that protects privacy and cost
 * lives here: configuration, consent, the daily allowance, on-device redaction
 * (fail closed) and cancellation. Provider errors other than the server quota
 * are rethrown for the caller to present.
 */
export async function recognizeWithGates(
  gates: RecognitionGates,
  image: PreparedImage | null,
  redaction: RedactionSummary | null,
  signal: AbortSignal,
): Promise<GatedOutcome> {
  const stopped = () => signal.aborted;
  if (gates.mode === 'unconfigured') return { kind: 'manual', reason: 'unconfigured' };
  if (gates.mode === 'remote' && !gates.consented()) return { kind: 'manual', reason: 'no_consent' };
  if (gates.mode === 'remote' && (await gates.allowance()) <= 0) {
    return stopped() ? { kind: 'aborted' } : { kind: 'manual', reason: 'quota' };
  }
  if (stopped()) return { kind: 'aborted' };
  const provider = await gates.provider();
  if (stopped()) return { kind: 'aborted' };
  if (!provider) return { kind: 'manual', reason: 'unconfigured' };
  if (!provider.simulated) {
    // Faces and plates must be pixelated on the phone before anything is uploaded.
    // If redaction did not run, or failed, the photo never leaves the device.
    if (redaction?.status !== 'redacted' || !image) return { kind: 'manual', reason: 'no_redaction' };
    await gates.noteUsed();
    // Last checks immediately before the photo leaves the device.
    if (stopped()) return { kind: 'aborted' };
    if (!gates.consented()) return { kind: 'manual', reason: 'no_consent' };
  }
  try {
    const result = await provider.recognize(image, signal);
    return stopped() ? { kind: 'aborted' } : { kind: 'result', result };
  } catch (e) {
    if (stopped()) return { kind: 'aborted' };
    if (e instanceof RecognitionError && e.code === 'quota_exceeded') return { kind: 'manual', reason: 'quota' };
    throw e;
  }
}
