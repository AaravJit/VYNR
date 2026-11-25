import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PreparedImage } from '@/recognition/types';

import { VynrRedaction } from '../../modules/vynr-redaction';

import { base64ToBytes, bytesToBase64, stripJpegMetadata } from './jpeg';

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
  // The encoder also writes a cache file; we only need the in-memory bytes.
  deleteFileQuietly(saved.uri);
  if (!saved.base64) throw new Error('Image encoding failed');
  // Defence in depth: the re-encode above should already drop EXIF/GPS, but strip again.
  const clean = bytesToBase64(stripJpegMetadata(base64ToBytes(saved.base64)));
  return { base64: clean, width: saved.width, height: saved.height };
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
 * 1. Faces and text-like regions (number plates) are pixelated on device at full
 *    resolution by the native VynrRedaction module. No text is read.
 * 2. The result is downscaled, re-encoded and metadata-stripped.
 *
 * The original capture and every intermediate file are deleted immediately.
 * When redaction is unavailable or fails, the photo is still prepared for the
 * on-screen preview, but `redaction.status` says so and callers must not upload
 * or keep it (the identify screen and saveThumbnail both enforce this).
 */
export async function prepareForRecognition(captureUri: string, width: number, height: number): Promise<CapturedPhoto> {
  let redactedUri: string | null = null;
  let redaction: RedactionSummary = { status: 'unavailable', faces: 0, plates: 0 };
  try {
    let source = { uri: captureUri, width, height };
    if (VynrRedaction) {
      try {
        const r = await VynrRedaction.redact(captureUri);
        redactedUri = r.uri;
        source = { uri: r.uri, width: r.width, height: r.height };
        redaction = { status: 'redacted', faces: r.faces, plates: r.textRegions };
      } catch {
        redaction = { status: 'failed', faces: 0, plates: 0 };
      }
    }
    const out = await render(source.uri, source.width, source.height, RECOGNITION_MAX_EDGE, 0.7);
    return {
      base64: out.base64,
      width: out.width,
      height: out.height,
      previewUri: `data:image/jpeg;base64,${out.base64}`,
      redaction,
    };
  } finally {
    deleteFileQuietly(captureUri);
    deleteFileQuietly(redactedUri);
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
    const dest = new File(photosDir(), `${encounterId}.jpg`);
    await dest.write(base64ToBytes(out.base64));
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
