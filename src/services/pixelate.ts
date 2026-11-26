import { decode } from 'jpeg-js';

import encode from '@/vendor/jpegEncoder';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'face' | 'text';
}

/** Extra margin around each detection, as a fraction of its size, so edges of faces and plates are covered too. */
const PADDING: Record<Region['kind'], number> = { face: 0.3, text: 0.25 };

/** Clamps a region (with padding) to the image and returns integer bounds, or null if nothing remains. */
export function expandRegion(r: Region, width: number, height: number) {
  const px = r.width * PADDING[r.kind];
  const py = r.height * PADDING[r.kind];
  const x0 = Math.max(0, Math.floor(r.x - px));
  const y0 = Math.max(0, Math.floor(r.y - py));
  const x1 = Math.min(width, Math.ceil(r.x + r.width + px));
  const y1 = Math.min(height, Math.ceil(r.y + r.height + py));
  if (!(x1 > x0 && y1 > y0)) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Block size for a region: coarse enough that faces and characters cannot be
 * recovered (each region becomes at most ~6 blocks across), and never below 12 px.
 */
export function blockSizeFor(w: number, h: number): number {
  return Math.max(12, Math.ceil(Math.max(w, h) / 6));
}

/**
 * Irreversibly pixelates the given regions of a JPEG and re-encodes it. The
 * output carries no metadata: the encoder writes only a JFIF header.
 * Pure JavaScript so it behaves identically on iOS, Android and in tests.
 */
export function pixelateJpeg(jpeg: Uint8Array, regions: Region[], quality = 70): Uint8Array {
  const img = decode(jpeg, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  const { width, height } = img;
  const data = img.data as Uint8Array;

  for (const r of regions) {
    const box = expandRegion(r, width, height);
    if (!box) continue;
    const block = blockSizeFor(box.x1 - box.x0, box.y1 - box.y0);
    for (let by = box.y0; by < box.y1; by += block) {
      for (let bx = box.x0; bx < box.x1; bx += block) {
        const ex = Math.min(bx + block, box.x1);
        const ey = Math.min(by + block, box.y1);
        let rs = 0;
        let gs = 0;
        let bs = 0;
        let n = 0;
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * width + x) * 4;
            rs += data[i]!;
            gs += data[i + 1]!;
            bs += data[i + 2]!;
            n++;
          }
        }
        const ra = Math.round(rs / n);
        const ga = Math.round(gs / n);
        const ba = Math.round(bs / n);
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * width + x) * 4;
            data[i] = ra;
            data[i + 1] = ga;
            data[i + 2] = ba;
          }
        }
      }
    }
  }
  return encode({ data, width, height }, quality).data;
}
