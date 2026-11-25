import type { TokenUsage } from '../limits.ts';
import type { RecognitionResponse } from '../shared/types.ts';
import type { ValidImage } from '../validation.ts';

export type UpstreamErrorKind = 'unavailable' | 'invalid_output' | 'refused' | 'rate_limited' | 'misconfigured';

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind;
  constructor(kind: UpstreamErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface VisionProvider {
  readonly id: string;
  /** `onUsage` is called with the billed token usage of every upstream call, even one whose output is then rejected. */
  identify(image: ValidImage, signal: AbortSignal, onUsage?: (usage: TokenUsage) => void): Promise<RecognitionResponse>;
}
