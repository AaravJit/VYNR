import { base64ToBytes, stripJpegMetadata } from './shared/jpeg.ts';

export const INSTALL_ID_PATTERN = /^[a-f0-9]{16,64}$/;

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ValidImage {
  /** Metadata-stripped JPEG bytes. */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Validates the client payload and returns a metadata-free JPEG. Throws RequestError. */
export function parseRecognizeRequest(body: unknown, limits: { maxImageBytes: number; maxImageEdge: number }): ValidImage {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError(400, 'invalid_body', 'Body must be a JSON object');
  }
  const { image, width, height } = body as Record<string, unknown>;
  if (typeof image !== 'string' || image.length === 0) throw new RequestError(400, 'invalid_image', 'image is required');
  for (const [name, v] of [['width', width], ['height', height]] as const) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 32 || v > limits.maxImageEdge) {
      throw new RequestError(400, 'invalid_dimensions', `${name} must be an integer between 32 and ${limits.maxImageEdge}`);
    }
  }
  // Cheap size check before decoding: 4 base64 chars encode 3 bytes.
  if (Math.floor((image.length * 3) / 4) > limits.maxImageBytes + 3) {
    throw new RequestError(413, 'image_too_large', 'Image is too large');
  }
  if (image.length % 4 !== 0 || !BASE64_PATTERN.test(image)) {
    throw new RequestError(400, 'invalid_image', 'image must be base64');
  }
  const bytes = base64ToBytes(image);
  if (bytes.length > limits.maxImageBytes) throw new RequestError(413, 'image_too_large', 'Image is too large');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new RequestError(415, 'unsupported_image', 'Only JPEG images are accepted');
  }
  let jpeg: Uint8Array;
  try {
    // Defence in depth: the app already strips metadata; never forward it upstream.
    jpeg = stripJpegMetadata(bytes);
  } catch {
    throw new RequestError(400, 'invalid_image', 'Image is not a valid JPEG');
  }
  return { jpeg, width: width as number, height: height as number };
}
