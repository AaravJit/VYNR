import type { RecognitionResponse } from '../shared/types.ts';
import type { ValidImage } from '../validation.ts';

export type UpstreamErrorKind = 'unavailable' | 'invalid_output' | 'refused' | 'rate_limited' | 'misconfigured';

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind;
  /** Spend already incurred before the failure (e.g. a truncated or refused response is still billed). */
  readonly costMicros: number;
  constructor(kind: UpstreamErrorKind, message: string, costMicros = 0) {
    super(message);
    this.kind = kind;
    this.costMicros = costMicros;
  }
}

export interface ModelCall {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

export interface Identification {
  response: RecognitionResponse;
  /** One entry per model call made for this identification (a tiered provider may make two). */
  calls: ModelCall[];
}

export interface VisionProvider {
  readonly id: string;
  /** Upper bound on what one identify() may cost, in micro-dollars. Reserved before the call. */
  readonly worstCaseMicros: number;
  identify(image: ValidImage, signal: AbortSignal): Promise<Identification>;
}
