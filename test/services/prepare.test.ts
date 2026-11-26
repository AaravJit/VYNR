/** prepareForRecognition must report redaction honestly so callers can fail closed. */
import { RedactionUnavailableError } from '@/services/redaction';
import encode from '@/vendor/jpegEncoder';

const mockDeleted: string[] = [];
const mockTiny = (() => {
  const data = new Uint8Array(64 * 48 * 4).fill(128);
  return Buffer.from(encode({ data, width: 64, height: 48 }, 80).data).toString('base64');
})();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
  Directory: class {},
  Paths: { cache: 'file:///cache', document: 'file:///docs' },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize() {},
      renderAsync: async () => ({
        saveAsync: async () => ({ uri: 'file:///cache/encoded.jpg', base64: mockTiny, width: 64, height: 48 }),
      }),
    }),
  },
}));

const { prepareForRecognition } = require('@/services/imageService') as typeof import('@/services/imageService');

beforeEach(() => {
  mockDeleted.length = 0;
});

it('marks the photo as not redacted when detection fails, and deletes every file', async () => {
  const failing = { detect: jest.fn(async () => Promise.reject(new Error('model missing'))) };
  const out = await prepareForRecognition('file:///capture.jpg', 4000, 3000, failing);
  expect(out.redaction.status).toBe('failed');
  expect(failing.detect).toHaveBeenCalledWith('file:///cache/encoded.jpg');
  expect(mockDeleted.sort()).toEqual(['file:///cache/encoded.jpg', 'file:///capture.jpg']);
});

it('returns a redacted, metadata-free image and reports how many areas were blurred', async () => {
  const detector = { detect: async () => [{ x: 10, y: 10, width: 20, height: 10, kind: 'text' as const }] };
  const out = await prepareForRecognition('file:///capture.jpg', 4000, 3000, detector);
  expect(out.redaction).toEqual({ status: 'redacted', faces: 0, plates: 1 });
  expect(out.previewUri.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(out.base64).not.toBe(mockTiny);
  expect(mockDeleted.sort()).toEqual(['file:///cache/encoded.jpg', 'file:///capture.jpg']);
});

it('reports unavailable when the native detector is missing (Expo Go, web)', async () => {
  const missing = { detect: async () => Promise.reject(new RedactionUnavailableError()) };
  const out = await prepareForRecognition('file:///capture.jpg', 4000, 3000, missing);
  expect(out.redaction.status).toBe('unavailable');
});
