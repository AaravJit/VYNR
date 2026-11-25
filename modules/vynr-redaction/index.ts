import { requireOptionalNativeModule } from 'expo';

export interface NativeRedactionResult {
  /** file:// URI of an upright JPEG with every detected region pixelated. */
  uri: string;
  width: number;
  height: number;
  faces: number;
  /** Text-like regions (number plates, signs). Only their positions are used; no text is read. */
  textRegions: number;
}

interface VynrRedactionNative {
  redact(uri: string): Promise<NativeRedactionResult>;
}

/** null when the native module is not linked (Expo Go, web, Jest). Callers must fail closed. */
export const VynrRedaction = requireOptionalNativeModule<VynrRedactionNative>('VynrRedaction');
