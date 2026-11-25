import { isApproved } from './dataSources';
import { SPEC_ACCESSED, SPECS } from './specs.data';

/** The licensing register entry that governs every record in specs.data.ts. */
export const SPECS_SOURCE = 'wikipedia-specs-2026-11' as const;

/**
 * Verified factory specifications per catalog generation.
 *
 * Every record lists the sources it was taken from (docs/DATA_PROVENANCE.md).
 * Fields are omitted when no source stated them; nothing is estimated. Engine,
 * drivetrain and transmission entries are the options offered for the whole
 * generation, never a claim about the photographed car's configuration.
 */
export interface EngineOption {
  name: string;
  configuration: string | null;
  displacementCc: number | null;
  aspiration: 'NA' | 'turbo' | 'twin-turbo' | 'supercharged' | 'hybrid' | 'electric' | null;
  powerHp: number | null;
  powerKw: number | null;
  torqueNm: number | null;
  note: string | null;
}

export interface PerformanceFigure {
  metric: string;
  value: string;
  variant: string | null;
}

export interface VehicleSpecs {
  chassis: string | null;
  bodyStyles: string[];
  layout: string | null;
  drivetrains: string[];
  engines: EngineOption[];
  transmissions: string[];
  performance: PerformanceFigure[];
  sources: { title: string; url: string }[];
}

export { SPEC_ACCESSED };

/** Returns specs only when their source is approved in the licensing register; quarantined data is never shown. */
export function getSpecs(vehicleId: string): VehicleSpecs | undefined {
  if (!isApproved(SPECS_SOURCE)) return undefined;
  return SPECS[vehicleId];
}

/** For audits and tests only: the stored record regardless of approval. Never render this. */
export function getQuarantinedSpecs(vehicleId: string): VehicleSpecs | undefined {
  return SPECS[vehicleId];
}

export function formatPower(e: EngineOption): string | null {
  if (e.powerHp != null) return `${e.powerHp} hp${e.powerKw != null ? ` (${e.powerKw} kW)` : ''}`;
  if (e.powerKw != null) return `${e.powerKw} kW`;
  return null;
}
