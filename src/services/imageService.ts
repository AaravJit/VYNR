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
  // The encoder writes a cache file. The caller must delete it (`saved.uri`) once done.
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!saved.base64) {
    deleteFileQuietly(saved.uri);
    throw new Error('Image encoding failed');
  }
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

/**
 * Converts a raw camera capture into a recognition-ready image: downscaled,
 * re-encoded, faces and text (including licence plates) pixelated on the
 * device, and metadata-stripped. The original capture and every intermediate
 * file are deleted immediately.
 *
 * Fails closed: if redaction cannot run, this throws and the photo is neither
 * uploaded nor kept.
 */
export async function prepareForRecognition(
  captureUri: string,
  width: number,
  height: number,
  detector: RegionDetector = mlKitDetector(),
): Promise<PreparedImage & { previewUri: string; redactedRegions: number }> {
  let encoded: Awaited<ReturnType<typeof render>> | null = null;
  try {
    encoded = await render(captureUri, width, height, RECOGNITION_MAX_EDGE, 0.85);
    let regions;
    try {
      regions = await detector.detect(encoded.uri);
    } catch (e) {
      throw e instanceof RedactionUnavailableError ? e : new RedactionUnavailableError();
    }
    const redacted = stripJpegMetadata(pixelateJpeg(base64ToBytes(encoded.base64), regions, 70));
    const base64 = bytesToBase64(redacted);
    return {
      base64,
      width: encoded.width,
      height: encoded.height,
      previewUri: `data:image/jpeg;base64,${base64}`,
      redactedRegions: regions.length,
    };
  } finally {
    deleteFileQuietly(encoded?.uri);
    deleteFileQuietly(captureUri);
  }
}

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Persists a small, metadata-free thumbnail for the garage (only when the player opted in). */
export async function saveThumbnail(prepared: PreparedImage, encounterId: string): Promise<string> {
  const tmp = new File(Paths.cache, `vynr-${encounterId}.jpg`);
  await tmp.write(base64ToBytes(prepared.base64));
  try {
    // `prepared` is already redacted, so the thumbnail never contains faces or plates.
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
