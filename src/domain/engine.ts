import type { Catalog } from '@/catalog';

import { ACHIEVEMENTS, isAchievementMet } from './achievements';
import type { GameConfig } from './config';
import { computeContractProgress, generateContracts } from './contracts';
import { encounterXp, type EncounterXp, levelInfo, type LevelInfo } from './progression';
import { computeStats, type PlayerStats } from './stats';
import { dayKey, periodKey } from './time';
import type {
  AwardRecord,
  Contract,
  ContractPeriod,
  EncounterRecord,
  EncounterSource,
  GameSnapshot,
  LedgerEntry,
  XpLineItem,
} from './types';

export interface EncounterInput {
  vehicleId: string | null;
  label: string | null;
  source: EncounterSource;
  confidence: number | null;
  provider: string | null;
  photoUri: string | null;
  now: number;
}

export interface EncounterOutcome {
  encounter: EncounterRecord;
  encounterXp: EncounterXp | null;
  ledger: LedgerEntry[];
  /** New or changed contracts to persist. */
  contracts: Contract[];
  completedContracts: Contract[];
  awards: AwardRecord[];
  lineItems: XpLineItem[];
  totalXpAwarded: number;
  levelBefore: LevelInfo;
  levelAfter: LevelInfo;
  stats: PlayerStats;
}

export type IdFactory = () => string;

/** Max unknown-vehicle logs per day that award XP (prevents farming uncatalogued entries). */
export const UNKNOWN_XP_DAILY_CAP = 5;

/** Returns contracts for the current periods that are missing from `existing`. */
export function missingContracts(
  playerId: string,
  existing: Contract[],
  now: number,
  config: GameConfig,
): Contract[] {
  const out: Contract[] = [];
  for (const period of ['daily', 'weekly'] as ContractPeriod[]) {
    const key = periodKey(period, now);
    if (!existing.some((c) => c.periodKey === key)) {
      out.push(...generateContracts(playerId, period, now, config));
    }
  }
  return out;
}

/**
 * Pure progression engine: evaluates a new encounter against the current game
 * state and returns everything that must be persisted. Performs no I/O.
 */
export function applyEncounter(
  snapshot: GameSnapshot,
  input: EncounterInput,
  catalog: Catalog,
  config: GameConfig,
  newId: IdFactory,
): EncounterOutcome {
  const { now } = input;
  const vehicle = input.vehicleId ? catalog.getVehicle(input.vehicleId) : undefined;
  if (input.vehicleId && !vehicle) {
    throw new Error(`Vehicle ${input.vehicleId} is not in the catalog`);
  }

  const levelBefore = levelInfo(snapshot.totalXp, config);
  const ledger: LedgerEntry[] = [];
  const lineItems: XpLineItem[] = [];
  const pushXp = (item: XpLineItem) => {
    if (item.amount <= 0) return;
    lineItems.push(item);
    ledger.push({ id: newId(), amount: item.amount, reason: item.reason, refId: item.refId, createdAt: now });
  };

  // 1. Encounter XP
  let xp: EncounterXp | null = null;
  let encounterIndex = 0;
  let amount = 0;
  if (vehicle) {
    const prior = snapshot.encounters.filter((e) => e.vehicleId === vehicle.id);
    encounterIndex = prior.length;
    const last = prior.reduce<number | null>((m, e) => (m === null || e.createdAt > m ? e.createdAt : m), null);
    xp = encounterXp(vehicle.rarity, encounterIndex, last === null ? null : now - last, config);
    amount = xp.amount;
  } else {
    const today = dayKey(now);
    const unknownToday = snapshot.encounters.filter(
      (e) => e.vehicleId === null && dayKey(e.createdAt) === today && e.xpAwarded > 0,
    ).length;
    amount = unknownToday < UNKNOWN_XP_DAILY_CAP ? config.unknownVehicleXp : 0;
  }

  const encounter: EncounterRecord = {
    id: newId(),
    vehicleId: vehicle?.id ?? null,
    label: vehicle ? null : (input.label?.trim() || 'Unidentified vehicle'),
    source: input.source,
    confidence: input.confidence,
    provider: input.provider,
    xpAwarded: amount,
    encounterIndex,
    isFirstDiscovery: Boolean(vehicle) && encounterIndex === 0,
    photoUri: input.photoUri,
    createdAt: now,
  };
  const label = vehicle
    ? encounter.isFirstDiscovery
      ? `First discovery · ${catalog.displayName(vehicle)}`
      : `Re-encounter #${encounterIndex + 1} · ${catalog.displayName(vehicle)}`
    : `Field note · ${encounter.label}`;
  pushXp({ label, amount, reason: 'encounter', refId: encounter.id });

  const encounters = [...snapshot.encounters, encounter];

  // 2. Contracts
  const allContracts = [...snapshot.contracts, ...missingContracts(snapshot.playerId, snapshot.contracts, now, config)];
  const currentKeys = new Set([periodKey('daily', now), periodKey('weekly', now)]);
  const changedContracts: Contract[] = [];
  const completedContracts: Contract[] = [];
  const snapshotIds = new Set(snapshot.contracts.map((c) => c.id));
  for (const c of allContracts) {
    if (!currentKeys.has(c.periodKey)) continue;
    if (c.completedAt !== null) continue;
    const progress = computeContractProgress(c, encounters, catalog);
    const done = progress >= c.target;
    const updated: Contract = { ...c, progress, completedAt: done ? now : null };
    if (!snapshotIds.has(c.id) || progress !== c.progress || done) changedContracts.push(updated);
    if (done) {
      completedContracts.push(updated);
      pushXp({ label: `Contract complete`, amount: c.rewardXp, reason: 'contract', refId: c.id });
    }
  }
  const contractsCompleted =
    allContracts.filter((c) => c.completedAt !== null).length + completedContracts.length;

  // 3. Awards: achievements, manufacturer completion, collection milestones
  const stats = computeStats(encounters, catalog, now);
  const awarded = new Set(snapshot.awards.map((a) => a.key));
  const awards: AwardRecord[] = [];
  const grant = (key: string, kind: AwardRecord['kind'], xpAmount: number, title: string) => {
    if (awarded.has(key)) return;
    awarded.add(key);
    awards.push({ key, kind, xp: xpAmount, awardedAt: now });
    const reason = kind === 'achievement' ? 'achievement' : kind;
    pushXp({ label: title, amount: xpAmount, reason, refId: key });
  };
  const ctx = { stats, contractsCompleted };
  for (const def of ACHIEVEMENTS) {
    if (isAchievementMet(def, ctx)) grant(`achievement:${def.key}`, 'achievement', def.xp, `Achievement · ${def.title}`);
  }
  for (const mId of stats.completedManufacturers) {
    const name = catalog.getManufacturer(mId)?.name ?? mId;
    grant(`manufacturer:${mId}`, 'manufacturer_complete', config.manufacturerCompletionXp, `${name} collection complete`);
  }
  for (const m of config.collectionMilestones) {
    if (stats.completionPercent >= m.percent) {
      grant(`milestone:${m.percent}`, 'collection_milestone', m.xp, `Collection ${m.percent}% complete`);
    }
  }

  const totalXpAwarded = ledger.reduce((s, l) => s + l.amount, 0);
  const levelAfter = levelInfo(snapshot.totalXp + totalXpAwarded, config);

  return {
    encounter,
    encounterXp: xp,
    ledger,
    contracts: changedContracts,
    completedContracts,
    awards,
    lineItems,
    totalXpAwarded,
    levelBefore,
    levelAfter,
    stats,
  };
}
