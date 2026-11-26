/** Image prepared for recognition: resized, re-encoded JPEG with no metadata. */
export interface PreparedImage {
  base64: string;
  width: number;
  height: number;
}

/** A raw prediction from a provider. Never trusted until validated. */
export interface RecognitionCandidate {
  make: string;
  model: string;
  /** Generation / chassis designation if the provider is confident; otherwise null. */
  generation: string | null;
  /** 0..1 */
  confidence: number;
}

export interface RecognitionResponse {
  vehicleDetected: boolean;
  candidates: RecognitionCandidate[];
  /** Short neutral note from the provider (e.g. "vehicle partially obscured"). */
  notes: string | null;
}

export interface RecognitionResult extends RecognitionResponse {
  provider: string;
  simulated: boolean;
}

export interface RecognitionProvider {
  readonly id: string;
  /** True when results are not real identifications (development mock). */
  readonly simulated: boolean;
  recognize(image: PreparedImage | null, signal?: AbortSignal): Promise<RecognitionResult>;
}

export type RecognitionErrorCode =
  | 'unconfigured'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'invalid_request'
  | 'invalid_response'
  | 'server';

export class RecognitionError extends Error {
  constructor(
    readonly code: RecognitionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RecognitionError';
  }
}

export function userMessageFor(error: unknown): string {
  if (!(error instanceof RecognitionError)) return 'Something went wrong while analysing the photo.';
  switch (error.code) {
    case 'unconfigured':
      return 'Automatic identification is not configured in this build. You can still identify the vehicle manually.';
    case 'network':
      return 'Could not reach the recognition service. Check your connection and try again.';
    case 'timeout':
      return 'The recognition service took too long to respond.';
    case 'rate_limited':
      return 'You are scanning faster than the service allows. Wait a moment and try again.';
    case 'quota_exceeded':
      return 'Today’s automatic identification limit has been reached. You can still identify vehicles manually.';
    case 'invalid_request':
      return 'The photo could not be processed. Try retaking it.';
    case 'invalid_response':
      return 'The recognition service returned an unexpected result.';
    case 'server':
      return 'The recognition service is having trouble right now.';
  }
}
