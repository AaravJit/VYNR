import type { RecognitionResponse } from '../shared/types.ts';
import type { ValidImage } from '../validation.ts';
import { type Identification, type ModelCall, UpstreamError, type VisionProvider } from './types.ts';

export interface EscalationPolicy {
  /** Escalate when the top candidate's self-reported confidence is below this. */
  minConfidence: number;
  /** Escalate when the top two candidates name different models and are closer than this. */
  minMargin: number;
}

export const DEFAULT_ESCALATION: EscalationPolicy = { minConfidence: 0.7, minMargin: 0.15 };

/** Decides whether a cheap first-pass answer is uncertain enough to justify a second, more capable model. */
export function needsEscalation(r: RecognitionResponse, policy: EscalationPolicy): boolean {
  // A confident "no vehicle" is accepted: escalating every empty frame would double the cost of misfires.
  if (!r.vehicleDetected) return false;
  const [top, second] = r.candidates;
  if (!top) return true;
  if (top.confidence < policy.minConfidence) return true;
  if (second && sameModel(top, second) === false && top.confidence - second.confidence < policy.minMargin) return true;
  return false;
}

function sameModel(a: { make: string; model: string }, b: { make: string; model: string }): boolean {
  const n = (s: string) => s.trim().toLowerCase();
  return n(a.make) === n(b.make) && n(a.model) === n(b.model);
}

/**
 * Cost-aware cascade: a fast, inexpensive model answers first and a more
 * capable model is consulted only when the first answer is uncertain. If the
 * escalation fails for any reason, the first answer is still returned so a
 * paid-for result is never thrown away.
 */
export class TieredVisionProvider implements VisionProvider {
  readonly id: string;
  readonly worstCaseMicros: number;
  private readonly primary: VisionProvider;
  private readonly secondary: VisionProvider | null;
  private readonly policy: EscalationPolicy;

  constructor(primary: VisionProvider, secondary: VisionProvider | null, policy: EscalationPolicy = DEFAULT_ESCALATION) {
    this.primary = primary;
    this.secondary = secondary;
    this.policy = policy;
    this.id = secondary ? `${primary.id}>${secondary.id}` : primary.id;
    this.worstCaseMicros = primary.worstCaseMicros + (secondary?.worstCaseMicros ?? 0);
  }

  async identify(image: ValidImage, signal: AbortSignal): Promise<Identification> {
    let first: Identification | null = null;
    const calls: ModelCall[] = [];
    try {
      first = await this.primary.identify(image, signal);
      calls.push(...first.calls);
      if (!this.secondary || !needsEscalation(first.response, this.policy)) return first;
    } catch (e) {
      // A refusal or invalid output from the fast tier is worth one careful retry; outages and auth errors are not.
      const retryable = e instanceof UpstreamError && (e.kind === 'invalid_output' || e.kind === 'refused');
      if (!this.secondary || !retryable) throw e;
      calls.push({ model: this.primary.id, inputTokens: 0, outputTokens: 0, costMicros: (e as UpstreamError).costMicros });
    }
    if (signal.aborted) {
      if (first) return { response: first.response, calls };
      throw new UpstreamError('unavailable', 'aborted', sum(calls));
    }
    try {
      const second = await this.secondary.identify(image, signal);
      return { response: second.response, calls: [...calls, ...second.calls] };
    } catch (e) {
      const spent = sum(calls) + (e instanceof UpstreamError ? e.costMicros : 0);
      if (first) return { response: first.response, calls: [...calls, { model: this.secondary.id, inputTokens: 0, outputTokens: 0, costMicros: spent - sum(calls) }] };
      if (e instanceof UpstreamError) throw new UpstreamError(e.kind, e.message, spent);
      throw e;
    }
  }
}

function sum(calls: ModelCall[]): number {
  return calls.reduce((a, c) => a + c.costMicros, 0);
}
