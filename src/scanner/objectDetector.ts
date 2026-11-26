import { type Box, clampBox } from './tracking';

/**
 * Proposes object boxes in a frame, entirely on the device.
 *
 * ML Kit's default object detector has no "vehicle" class (its coarse
 * categories are home goods, fashion, food, plants and places), so it is used
 * only as a class-agnostic box proposer: it tells the scanner where the main
 * object is, how big it is and whether it is holding still. Whether that object
 * is a vehicle is decided by the cloud answer, which the gates in
 * `livePolicy.ts` keep rare. See docs/SOURCE_REGISTER.md.
 */
export interface ObjectProposer {
  /** Boxes normalised to the image size (0..1), largest first. */
  propose(fileUri: string, width: number, height: number): Promise<Box[]>;
}

export class DetectorUnavailableError extends Error {
  constructor(message = 'On-device object detection is not available.') {
    super(message);
    this.name = 'DetectorUnavailableError';
  }
}

interface RawRect {
  origin?: { x: number; y: number };
  size?: { x: number; y: number };
}

/** Converts ML Kit frames (image pixels) into normalised boxes, dropping malformed ones. */
export function normaliseFrames(frames: RawRect[], width: number, height: number): Box[] {
  if (!(width > 0 && height > 0)) return [];
  const boxes: Box[] = [];
  for (const f of frames) {
    if (!f.origin || !f.size) continue;
    const b = clampBox({ x: f.origin.x / width, y: f.origin.y / height, width: f.size.x / width, height: f.size.y / height });
    if (Number.isFinite(b.x + b.y + b.width + b.height) && b.width > 0 && b.height > 0) boxes.push(b);
  }
  return boxes.sort((a, b) => b.width * b.height - a.width * a.height);
}

type DetectorModule = typeof import('@infinitered/react-native-mlkit-object-detection');
type Detector = InstanceType<DetectorModule['RNMLKitDefaultObjectDetector']>;

let shared: Promise<Detector> | null = null;

/** ML Kit default detector in single-image mode with multiple objects. Loaded lazily, once. */
export function mlKitObjectProposer(): ObjectProposer {
  return {
    async propose(fileUri, width, height) {
      if (!shared) {
        shared = (async () => {
          let mod: DetectorModule;
          try {
            // Lazy require: throws where the native module is missing (Expo Go, web, tests).
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            mod = require('@infinitered/react-native-mlkit-object-detection');
          } catch {
            throw new DetectorUnavailableError();
          }
          const d = new mod.RNMLKitDefaultObjectDetector({
            detectorMode: 'singleImage',
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: false,
          });
          await d.load();
          return d;
        })();
        // A failed load is not cached, so a later attempt can retry.
        shared.catch(() => {
          shared = null;
        });
      }
      const detector = await shared;
      const objects = await detector.detectObjects(fileUri);
      return normaliseFrames(
        (objects ?? []).map((o) => o.frame as unknown as RawRect),
        width,
        height,
      );
    },
  };
}

/**
 * Fallback when no detector is available (web preview, Expo Go): the centre of
 * the frame is treated as the target, so framing still relies on the player and
 * the other gates (sharpness, exposure, stability via the perceptual hash, cooldown,
 * session cap) still apply. Never used to claim a vehicle was found.
 */
export const centreProposer: ObjectProposer = {
  async propose() {
    return [{ x: 0.15, y: 0.25, width: 0.7, height: 0.5 }];
  },
};
