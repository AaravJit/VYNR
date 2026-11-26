import { decode } from 'jpeg-js';

/**
 * Cheap, pure image measurements used to decide whether a camera frame is
 * worth sending for identification. They run on a small (≈160 px) copy of the
 * frame so they cost a few milliseconds.
 */
export interface FrameMetrics {
  /** Variance of the Laplacian: higher is sharper. Blurry or moving frames score low. */
  sharpness: number;
  /** Mean luma 0..255: rejects frames that are too dark or blown out. */
  luma: number;
  /** 64-bit difference hash (16 hex chars) for near-duplicate suppression. */
  hash: string;
}

export function toGray(rgba: Uint8Array, width: number, height: number): Float32Array {
  const g = new Float32Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return g;
}

export function meanLuma(gray: Float32Array): number {
  let s = 0;
  for (const v of gray) s += v;
  return gray.length ? s / gray.length : 0;
}

export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const l = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Area-averaged sample of a w×h grid cell. */
function sampleCell(gray: Float32Array, width: number, height: number, cx: number, cy: number, cols: number, rows: number): number {
  const x0 = Math.floor((cx * width) / cols);
  const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / cols));
  const y0 = Math.floor((cy * height) / rows);
  const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / rows));
  let s = 0;
  let n = 0;
  for (let y = y0; y < y1 && y < height; y++) {
    for (let x = x0; x < x1 && x < width; x++) {
      s += gray[y * width + x]!;
      n++;
    }
  }
  return n ? s / n : 0;
}

/** dHash: compares horizontally adjacent cells of a 9×8 downsample. */
export function differenceHash(gray: Float32Array, width: number, height: number): string {
  let hex = '';
  let nibble = 0;
  let bits = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const a = sampleCell(gray, width, height, col, row, 9, 8);
      const b = sampleCell(gray, width, height, col + 1, row, 9, 8);
      nibble = (nibble << 1) | (a > b ? 1 : 0);
      bits++;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function metricsFromRgba(rgba: Uint8Array, width: number, height: number): FrameMetrics {
  const gray = toGray(rgba, width, height);
  return { sharpness: laplacianVariance(gray, width, height), luma: meanLuma(gray), hash: differenceHash(gray, width, height) };
}

export function metricsFromJpeg(jpeg: Uint8Array): FrameMetrics {
  const img = decode(jpeg, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 64 });
  return metricsFromRgba(img.data, img.width, img.height);
}
