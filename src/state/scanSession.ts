import type { EncounterOutcome } from '@/domain/engine';
import type { PreparedImage, RecognitionResult } from '@/recognition/types';

/**
 * The in-flight scan lives only in memory: the photo is never written to disk
 * unless the player opted into keeping photos and confirms the encounter.
 */
export interface ScanSession {
  id: string;
  image: PreparedImage | null;
  previewUri: string | null;
  /** Faces and text regions pixelated on the device before the photo could be sent or kept. */
  redactedRegions?: number;
  result: RecognitionResult | null;
  /** Vehicle chosen manually from the catalog picker, overriding the prediction. */
  manualVehicleId?: string | null;
  /** Free-text label when the player logs an uncatalogued vehicle. */
  unknownLabel?: string | null;
  createdAt: number;
}

let current: ScanSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeScanSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentScanSession(): ScanSession | null {
  return current;
}

export function startScanSession(session: ScanSession): void {
  current = session;
  emit();
}

export function getScanSession(id: string | undefined): ScanSession | null {
  return current && current.id === id ? current : null;
}

export function updateScanSession(id: string, patch: Partial<Omit<ScanSession, 'id'>>): void {
  if (current?.id === id) {
    current = { ...current, ...patch };
    emit();
  }
}

export function clearScanSession(): void {
  current = null;
  emit();
}

// Outcomes are handed from the identify screen to the discovery screen in memory.
const outcomes = new Map<string, EncounterOutcome>();

export function stashOutcome(outcome: EncounterOutcome): void {
  outcomes.clear();
  outcomes.set(outcome.encounter.id, outcome);
}

export function getOutcome(encounterId: string | undefined): EncounterOutcome | undefined {
  return encounterId ? outcomes.get(encounterId) : undefined;
}
