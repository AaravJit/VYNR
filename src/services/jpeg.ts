/**
 * Minimal JPEG metadata stripper. Removes APP1–APP15 (EXIF, XMP, ICC, maker
 * notes, GPS) and COM segments while keeping the image data intact. APP0 (JFIF)
 * is preserved. Used as a defence-in-depth step after re-encoding so no
 * location or device metadata can leave the device even if a platform encoder
 * changes behaviour.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Not a JPEG');
  }
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('Corrupt JPEG marker');
    // Skip fill bytes
    let marker = bytes[i + 1]!;
    while (marker === 0xff && i + 2 < bytes.length) {
      i++;
      marker = bytes[i + 1]!;
    }
    // Start of scan: copy the remainder verbatim (entropy-coded data + EOI).
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]!);
      return Uint8Array.from(out);
    }
    // Standalone markers without length
    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) throw new Error('Truncated JPEG');
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2 || i + 2 + len > bytes.length) throw new Error('Invalid JPEG segment length');
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) {
      for (let j = i; j < i + 2 + len; j++) out.push(bytes[j]!);
    }
    i += 2 + len;
  }
  return Uint8Array.from(out);
}

export function hasExif(bytes: Uint8Array): boolean {
  let i = 2;
  while (i + 4 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    if (marker === 0xda) return false;
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker === 0xe1) return true;
    i += 2 + len;
  }
  return false;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | B64_LOOKUP[clean.charCodeAt(i)]!;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + '==';
  } else if (rem === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + '=';
  }
  return out;
}
