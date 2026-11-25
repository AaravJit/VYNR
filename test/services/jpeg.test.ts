import { base64ToBytes, bytesToBase64, hasExif, stripJpegMetadata } from '@/services/jpeg';

/** Builds a minimal JPEG-like byte stream with the given segments followed by SOS data and EOI. */
function jpeg(...segments: [number, number[]][]): Uint8Array {
  const out = [0xff, 0xd8];
  for (const [marker, payload] of segments) {
    const len = payload.length + 2;
    out.push(0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload);
  }
  out.push(0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xaa, 0xbb, 0xcc, 0xff, 0xd9);
  return Uint8Array.from(out);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('stripJpegMetadata', () => {
  it('removes EXIF/GPS (APP1), ICC (APP2) and comments while keeping JFIF, tables and image data', () => {
    const src = jpeg(
      [0xe0, ascii('JFIF\0')],
      [0xe1, [...ascii('Exif\0\0'), ...ascii('GPS 51.5N 0.12W')]],
      [0xe2, ascii('ICC_PROFILE')],
      [0xfe, ascii('secret comment')],
      [0xdb, [0, 1, 2, 3]],
    );
    expect(hasExif(src)).toBe(true);
    const out = stripJpegMetadata(src);
    expect(hasExif(out)).toBe(false);
    const text = String.fromCharCode(...out);
    expect(text).toContain('JFIF');
    expect(text).not.toContain('GPS');
    expect(text).not.toContain('ICC_PROFILE');
    expect(text).not.toContain('secret');
    // quantisation table + scan data preserved verbatim
    expect(Array.from(out.slice(-11))).toEqual([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xaa, 0xbb, 0xcc, 0xff, 0xd9]);
  });

  it('is idempotent', () => {
    const once = stripJpegMetadata(jpeg([0xe1, ascii('Exif\0\0x')], [0xdb, [1]]));
    expect(Array.from(stripJpegMetadata(once))).toEqual(Array.from(once));
  });

  it('rejects non-JPEG and corrupt input', () => {
    expect(() => stripJpegMetadata(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow('Not a JPEG');
    expect(() => stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x50, 0x01]))).toThrow();
  });
});

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes and matches Node encoding', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255, 1000]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 0xff);
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe(Buffer.from(bytes).toString('base64'));
      expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
    }
  });
});
