import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PreparedImage } from '@/recognition/types';

import { base64ToBytes, bytesToBase64, stripJpegMetadata } from './jpeg';
import { pixelateJpeg } from './pixelate';
import { mlKitDetector, type RegionDetector, RedactionUnavailableError } from './redaction';

/** Longest edge sent for recognition. Enough detail for make/model, too little for reading small text. */
export const RECOGNITION_MAX_EDGE = 1024;
const THUMBNAIL_MAX_EDGE = 640;

async function render(uri: string, width: number, height: number, maxEdge: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxEdge) {
    ctx.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
  }
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!saved.base64) {
    deleteFileQuietly(saved.uri);
    throw new Error('Image encoding failed');
  }
  // The caller deletes `uri` once it no longer needs the file (detection reads it first).
  return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
}

export function deleteFileQuietly(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Best effort: temporary files are also purged by the OS cache policy.
  }
}

/** Whether faces and plates were pixelated before the photo could leave the device or be kept. */
export interface RedactionSummary {
  status: 'redacted' | 'unavailable' | 'failed';
  faces: number;
  plates: number;
}

export interface CapturedPhoto extends PreparedImage {
  previewUri: string;
  redaction: RedactionSummary;
}

/**
 * Converts a raw camera capture into a recognition-ready image:
 *
 * 1. Downscale to 1024 px and re-encode (drops EXIF and GPS).
 * 2. Detect faces and text regions (which include number plates) on the device
 *    with ML Kit. Only bounding boxes are used; any recognised text is discarded.
 * 3. Pixelate every region in pure JavaScript, then strip metadata again.
 *
 * The original capture and every intermediate file are deleted immediately.
 * If detection is unavailable or fails, `redaction.status` says so, the
 * returned image is the unredacted preview, and callers must not upload or keep
 * it (fail closed; the identify screen, the live scanner and saveThumbnail all check).
 */
export async function prepareForRecognition(
  captureUri: string,
  width: number,
  height: number,
  detector: RegionDetector = mlKitDetector(),
): Promise<CapturedPhoto> {
  let encodedUri: string | null = null;
  try {
    const encoded = await render(captureUri, width, height, RECOGNITION_MAX_EDGE, 0.85);
    encodedUri = encoded.uri;
    let redaction: RedactionSummary;
    let bytes = base64ToBytes(encoded.base64);
    try {
      const regions = await detector.detect(encoded.uri);
      bytes = pixelateJpeg(bytes, regions, 70);
      redaction = {
        status: 'redacted',
        faces: regions.filter((r) => r.kind === 'face').length,
        plates: regions.filter((r) => r.kind === 'text').length,
      };
    } catch (e) {
      redaction = { status: e instanceof RedactionUnavailableError ? 'unavailable' : 'failed', faces: 0, plates: 0 };
    }
    const base64 = bytesToBase64(stripJpegMetadata(bytes));
    return {
      base64,
      width: encoded.width,
      height: encoded.height,
      previewUri: `data:image/jpeg;base64,${base64}`,
      redaction,
    };
  } finally {
    deleteFileQuietly(captureUri);
    deleteFileQuietly(encodedUri);
  }
}

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Persists a small, metadata-free thumbnail for the garage (only when the player opted in and the photo was redacted). */
export async function saveThumbnail(prepared: PreparedImage, encounterId: string): Promise<string> {
  const tmp = new File(Paths.cache, `vynr-${encounterId}.jpg`);
  await tmp.write(base64ToBytes(prepared.base64));
  try {
    const out = await render(tmp.uri, prepared.width, prepared.height, THUMBNAIL_MAX_EDGE, 0.6);
    deleteFileQuietly(out.uri);
    const dest = new File(photosDir(), `${encounterId}.jpg`);
    await dest.write(stripJpegMetadata(base64ToBytes(out.base64)));
    return dest.uri;
  } finally {
    deleteFileQuietly(tmp.uri);
  }
}

export function deleteAllPhotos(uris: string[]): void {
  for (const u of uris) deleteFileQuietly(u);
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
}
