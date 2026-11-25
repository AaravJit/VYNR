import { type Catalog, normalizeText } from '@/catalog';
import type { CatalogVehicle, Manufacturer } from '@/domain/types';

import type { RecognitionCandidate } from './types';

export type MatchQuality =
  /** Manufacturer, model and generation all matched a single catalog entry. */
  | 'generation'
  /** Manufacturer and model matched; generation is ambiguous or unconfirmed. */
  | 'model';

export interface CatalogMatch {
  vehicle: CatalogVehicle;
  /** Provider confidence for the underlying prediction (0..1). */
  confidence: number;
  quality: MatchQuality;
  /** The raw prediction this match came from. */
  prediction: RecognitionCandidate;
}

export interface MatchResult {
  matches: CatalogMatch[];
  /** Predictions that do not correspond to any catalog entry. */
  unmatched: RecognitionCandidate[];
}

const tokens = (s: string) => normalizeText(s).split(' ').filter(Boolean);

export function findManufacturer(catalog: Catalog, make: string): Manufacturer | undefined {
  const n = normalizeText(make);
  return catalog.manufacturers.find(
    (m) => normalizeText(m.name) === n || m.aliases.some((a) => normalizeText(a) === n),
  );
}

/** Score how well a catalog model name (or alias) is covered by the predicted model text. */
function modelScore(vehicle: CatalogVehicle, predicted: string): number {
  const p = normalizeText(predicted);
  const pTokens = new Set(tokens(predicted));
  let best = 0;
  for (const name of [vehicle.model, ...vehicle.aliases]) {
    const n = normalizeText(name);
    if (!n) continue;
    if (n === p) return 1000 + n.length;
    const nTokens = tokens(name);
    if (nTokens.length > 0 && nTokens.every((t) => pTokens.has(t))) {
      best = Math.max(best, n.length); // longer contained names win ("Civic Type R" over "Civic")
    }
  }
  return best;
}

function generationMatches(vehicle: CatalogVehicle, predicted: string | null): boolean {
  if (!predicted) return false;
  const g = new Set(tokens(vehicle.generation));
  return tokens(predicted).some((t) => g.has(t));
}

function matchOne(catalog: Catalog, c: RecognitionCandidate): CatalogMatch[] {
  const manufacturer = findManufacturer(catalog, c.make);
  if (!manufacturer) return [];
  const scored = catalog
    .vehiclesByManufacturer(manufacturer.id)
    .map((v) => ({ v, s: modelScore(v, c.model) }))
    .filter((x) => x.s > 0);
  if (scored.length === 0) return [];
  const top = Math.max(...scored.map((x) => x.s));
  const sameModel = scored.filter((x) => x.s === top).map((x) => x.v);
  if (sameModel.length === 1) {
    const v = sameModel[0]!;
    return [{ vehicle: v, confidence: c.confidence, quality: generationMatches(v, c.generation) || !c.generation ? 'generation' : 'model', prediction: c }];
  }
  const genHits = sameModel.filter((v) => generationMatches(v, c.generation));
  if (genHits.length === 1) {
    return [{ vehicle: genHits[0]!, confidence: c.confidence, quality: 'generation', prediction: c }];
  }
  // Ambiguous generation: offer every generation and let the player choose.
  return sameModel.map((v) => ({ vehicle: v, confidence: c.confidence, quality: 'model', prediction: c }));
}

/** Maps raw predictions onto the curated catalog, which is the source of truth for all facts. */
export function matchCandidates(catalog: Catalog, candidates: RecognitionCandidate[]): MatchResult {
  const byId = new Map<string, CatalogMatch>();
  const unmatched: RecognitionCandidate[] = [];
  for (const c of candidates) {
    const matches = matchOne(catalog, c);
    if (matches.length === 0) {
      unmatched.push(c);
      continue;
    }
    for (const m of matches) {
      const prev = byId.get(m.vehicle.id);
      if (!prev || m.confidence > prev.confidence) byId.set(m.vehicle.id, m);
    }
  }
  const matches = [...byId.values()].sort((a, b) => b.confidence - a.confidence);
  return { matches, unmatched };
}

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
