import { decode } from 'jpeg-js';

import { hasExif } from '@/services/jpeg';
import { blockSizeFor, expandRegion, pixelateJpeg } from '@/services/pixelate';
import encode from '@/vendor/jpegEncoder';

const W = 240;
const H = 160;

/** High-detail test image: a fine checkerboard, so any surviving detail is easy to measure. */
function checkerJpeg(): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = (x >> 1) % 2 === (y >> 1) % 2 ? 230 : 20;
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return encode({ data, width: W, height: H }, 95).data;
}

/** Mean absolute difference between horizontally adjacent pixels inside a box: high = detail, low = blocks. */
function detail(jpeg: Uint8Array, x0: number, y0: number, x1: number, y1: number): number {
  const img = decode(jpeg, { useTArray: true });
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      sum += Math.abs(img.data[i]! - img.data[i - 4]!);
      n++;
    }
  }
  return sum / n;
}

describe('pixelateJpeg', () => {
  it('destroys detail inside detected regions and leaves the rest of the photo intact', () => {
    const src = checkerJpeg();
    const out = pixelateJpeg(src, [{ x: 40, y: 40, width: 60, height: 30, kind: 'text' }]);
    // Inside the (unpadded) plate box the checkerboard is gone.
    expect(detail(src, 45, 45, 95, 65)).toBeGreaterThan(50);
    expect(detail(out, 45, 45, 95, 65)).toBeLessThan(12);
    // Far away from it, detail is preserved.
    expect(detail(out, 170, 100, 230, 150)).toBeGreaterThan(50);
    expect(decode(out, { useTArray: true })).toMatchObject({ width: W, height: H });
  });

  it('pads faces generously and clamps regions to the image', () => {
    expect(expandRegion({ x: 100, y: 50, width: 40, height: 40, kind: 'face' }, W, H)).toEqual({ x0: 88, y0: 38, x1: 152, y1: 102 });
    expect(expandRegion({ x: 230, y: 150, width: 40, height: 40, kind: 'face' }, W, H)).toEqual({ x0: 218, y0: 138, x1: W, y1: H });
    expect(expandRegion({ x: 500, y: 500, width: 10, height: 10, kind: 'text' }, W, H)).toBeNull();
  });

  it('uses coarse blocks so faces and characters cannot be recovered', () => {
    expect(blockSizeFor(30, 10)).toBe(12);
    expect(blockSizeFor(300, 90)).toBe(50);
  });

  it('writes no metadata and handles photos with nothing to redact', () => {
    const out = pixelateJpeg(checkerJpeg(), []);
    expect(hasExif(out)).toBe(false);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
  });
});
