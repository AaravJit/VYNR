import type { Region } from './pixelate';

/**
 * Finds faces and text (which includes licence plates) in an image file and
 * returns only their bounding boxes, in image pixels. Any recognised text is
 * discarded here and never returned, stored, logged or transmitted: VYNR does
 * not perform licence plate recognition.
 */
export interface RegionDetector {
  detect(fileUri: string): Promise<Region[]>;
}

export class RedactionUnavailableError extends Error {
  constructor(message = 'Privacy protection is not available on this device.') {
    super(message);
    this.name = 'RedactionUnavailableError';
  }
}

/** ML Kit detector (on-device; no network). Loaded lazily so tests and web never touch the native module. */
export function mlKitDetector(): RegionDetector {
  return {
    async detect(fileUri) {
      let faceModule: typeof import('@infinitered/react-native-mlkit-face-detection');
      let textModule: typeof import('@infinitered/react-native-mlkit-text-recognition');
      try {
        // Lazy require: these throw at import time where the native module is missing (Expo Go, web, tests).
        /* eslint-disable @typescript-eslint/no-require-imports */
        faceModule = require('@infinitered/react-native-mlkit-face-detection');
        textModule = require('@infinitered/react-native-mlkit-text-recognition');
        /* eslint-enable @typescript-eslint/no-require-imports */
      } catch {
        throw new RedactionUnavailableError();
      }
      const detector = new faceModule.RNMLKitFaceDetector({ performanceMode: 'accurate', minFaceSize: 0.02 }, true);
      await detector.initialize();
      const [faces, text] = await Promise.all([detector.detectFaces(fileUri), textModule.recognizeText(fileUri)]);
      if (!faces || !faces.success) throw new RedactionUnavailableError(faces?.error ?? 'Face detection failed.');

      const regions: Region[] = faces.faces.map((f) => ({
        x: f.frame.origin.x,
        y: f.frame.origin.y,
        width: f.frame.size.x,
        height: f.frame.size.y,
        kind: 'face',
      }));
      // Only geometry is kept. Lines (not whole blocks) give tight boxes around plates and other text.
      for (const block of text.blocks) {
        const lines = block.lines.length > 0 ? block.lines : [{ frame: block.frame }];
        for (const { frame } of lines) {
          regions.push({ x: frame.left, y: frame.top, width: frame.right - frame.left, height: frame.bottom - frame.top, kind: 'text' });
        }
      }
      return regions.filter((r) => Number.isFinite(r.x + r.y + r.width + r.height) && r.width > 0 && r.height > 0);
    },
  };
}
