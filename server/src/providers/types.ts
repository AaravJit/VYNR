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
  identify(image: ValidImage, signal: AbortSignal): Promise<RecognitionResponse>;
}
