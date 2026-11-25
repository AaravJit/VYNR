/**
 * Core domain types for VYNR. This module is pure TypeScript with no React Native
 * imports so it can be unit tested deterministically and reused by a future
 * multiplayer/sync backend.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'exotic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const COUNTRIES = ['JP', 'DE', 'US', 'GB', 'IT', 'KR'] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export const CATEGORIES = [
  'sedan',
  'hatchback',
  'wagon',
  'coupe',
  'convertible',
  'suv',
  'pickup',
  'van',
  'sports',
  'supercar',
  'hypercar',
  'offroad',
] as const;
export type VehicleCategory = (typeof CATEGORIES)[number];

export interface Manufacturer {
  id: string;
  name: string;
  country: CountryCode;
  /** Alternate spellings / common abbreviations used for recognition matching. */
  aliases: string[];
}

export interface CatalogVehicle {
  /** Stable, URL-safe identifier. Never reuse an id for a different vehicle. */
  id: string;
  manufacturerId: string;
  model: string;
  /** Generation / chassis designation as commonly published (e.g. "G20", "Mk8"). */
  generation: string;
  /** Estimated first production year (approximate, see docs/DATA_PROVENANCE.md). */
  yearStart: number;
  /** Estimated last production year, or null if still in production / unknown. */
  yearEnd: number | null;
  category: VehicleCategory;
  rarity: Rarity;
  electric: boolean;
  /** Alternate model names used for recognition matching. */
  aliases: string[];
}

/** How an encounter's identity was established. */
export type EncounterSource =
  | 'ai_confirmed' // recognition prediction confirmed by the player
  | 'ai_corrected' // recognition prediction corrected manually by the player
  | 'manual' // identified manually without a recognition prediction
  | 'simulated'; // development mode mock recognition

export interface EncounterRecord {
  id: string;
  /** Catalog vehicle id, or null for an unknown / uncatalogued vehicle. */
  vehicleId: string | null;
  /** Free-text label for unknown vehicles (e.g. "Unidentified sedan"). */
  label: string | null;
  source: EncounterSource;
  /** Recognition confidence 0..1 for the selected vehicle, when available. */
  confidence: number | null;
  provider: string | null;
  xpAwarded: number;
  /** 0-based count of prior encounters of this vehicle at the time of recording. */
  encounterIndex: number;
  isFirstDiscovery: boolean;
  photoUri: string | null;
  createdAt: number;
}

export type LedgerReason =
  | 'encounter'
  | 'contract'
  | 'achievement'
  | 'manufacturer_complete'
  | 'collection_milestone';

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: LedgerReason;
  refId: string;
  createdAt: number;
}

export type ContractPeriod = 'daily' | 'weekly';

export type ContractObjective =
  | { kind: 'spot_any' }
  | { kind: 'new_discovery' }
  | { kind: 'spot_manufacturer'; manufacturerId: string }
  | { kind: 'spot_country'; country: CountryCode }
  | { kind: 'spot_category'; category: VehicleCategory }
  | { kind: 'rarity_at_least'; rarity: Rarity }
  | { kind: 'distinct_countries' }
  | { kind: 'distinct_manufacturers' }
  | { kind: 'spot_electric' };

export interface Contract {
  id: string;
  period: ContractPeriod;
  periodKey: string;
  objective: ContractObjective;
  target: number;
  progress: number;
  rewardXp: number;
  completedAt: number | null;
  createdAt: number;
}

export type AwardKind = 'achievement' | 'manufacturer_complete' | 'collection_milestone';

export interface AwardRecord {
  key: string;
  kind: AwardKind;
  xp: number;
  awardedAt: number;
}

/** Everything the progression engine needs to evaluate a new encounter. */
export interface GameSnapshot {
  playerId: string;
  totalXp: number;
  encounters: EncounterRecord[];
  contracts: Contract[];
  awards: AwardRecord[];
}

export interface XpLineItem {
  label: string;
  amount: number;
  reason: LedgerReason;
  refId: string;
}
