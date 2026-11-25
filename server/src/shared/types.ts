// Wire types shared with the app (see src/recognition/types.ts in the app).
export interface RecognitionCandidate {
  make: string;
  model: string;
  generation: string | null;
  confidence: number;
}

export interface RecognitionResponse {
  vehicleDetected: boolean;
  candidates: RecognitionCandidate[];
  notes: string | null;
}
