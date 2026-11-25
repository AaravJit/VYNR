import type { RecognitionCandidate, RecognitionResponse } from './types';

export const MAX_CANDIDATES = 5;
const MAX_TEXT = 60;
const MAX_NOTES = 200;

// Strip control characters and collapse whitespace.
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Strictly validates an untrusted recognition payload (from the network or an
 * AI model). Returns null if the payload is malformed. Unknown fields are
 * dropped; out-of-range values are rejected rather than coerced.
 */
export function parseRecognitionResponse(input: unknown): RecognitionResponse | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.vehicleDetected !== 'boolean') return null;
  if (!Array.isArray(obj.candidates)) return null;

  const candidates: RecognitionCandidate[] = [];
  for (const raw of obj.candidates.slice(0, MAX_CANDIDATES)) {
    if (typeof raw !== 'object' || raw === null) return null;
    const c = raw as Record<string, unknown>;
    const make = cleanText(c.make, MAX_TEXT);
    const model = cleanText(c.model, MAX_TEXT);
    const generation = c.generation === null || c.generation === undefined ? null : cleanText(c.generation, MAX_TEXT);
    const confidence = c.confidence;
    if (!make || !model) return null;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return null;
    }
    candidates.push({ make, model, generation, confidence });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return {
    vehicleDetected: obj.vehicleDetected && candidates.length > 0,
    candidates: obj.vehicleDetected ? candidates : [],
    notes: cleanText(obj.notes, MAX_NOTES),
  };
}
