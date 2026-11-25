import { parseRecognitionResponse } from './validate';
import {
  type PreparedImage,
  RecognitionError,
  type RecognitionProvider,
  type RecognitionResult,
} from './types';

export interface RemoteProviderOptions {
  endpoint: string;
  installId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Calls the VYNR recognition backend. The backend holds the AI provider
 * credentials; this client only ever sends a downscaled, metadata-free JPEG
 * and an anonymous install id used for rate limiting.
 */
export class RemoteRecognitionProvider implements RecognitionProvider {
  readonly id = 'remote';
  readonly simulated = false;

  constructor(private readonly options: RemoteProviderOptions) {}

  async recognize(image: PreparedImage | null, signal?: AbortSignal): Promise<RecognitionResult> {
    if (!image) throw new RecognitionError('invalid_request', 'A photo is required.');
    const { endpoint, installId, timeoutMs = 25000, fetchImpl = fetch } = this.options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    let res: Response;
    try {
      res = await fetchImpl(`${endpoint.replace(/\/+$/, '')}/v1/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId },
        body: JSON.stringify({ image: image.base64, width: image.width, height: image.height }),
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted && !signal?.aborted
        ? new RecognitionError('timeout', 'Recognition timed out.')
        : new RecognitionError('network', 'Network request failed.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (res.status === 429) throw new RecognitionError('rate_limited', 'Rate limited.');
    if (res.status === 402 || res.status === 503) {
      throw new RecognitionError('quota_exceeded', 'Recognition budget exhausted.');
    }
    if (res.status >= 400 && res.status < 500) throw new RecognitionError('invalid_request', `HTTP ${res.status}`);
    if (!res.ok) throw new RecognitionError('server', `HTTP ${res.status}`);

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new RecognitionError('invalid_response', 'Response was not JSON.');
    }
    const parsed = parseRecognitionResponse(json);
    if (!parsed) throw new RecognitionError('invalid_response', 'Response failed validation.');
    return { ...parsed, provider: this.id, simulated: false };
  }
}
