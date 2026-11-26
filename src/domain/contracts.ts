import type { Catalog } from '@/catalog';
import { CATEGORY_LABELS, COUNTRY_NAMES, RARITY_LABELS, rarityRank } from '@/catalog';

import type { GameConfig } from './config';
import { pick, seededRandom, shuffle } from './rng';
import { periodEnd, periodKey, periodStart } from './time';
import type {
  Contract,
  ContractObjective,
  ContractPeriod,
  CountryCode,
  EncounterRecord,
  VehicleCategory,
} from './types';

interface Template {
  key: string;
  build: (rand: () => number) => { objective: ContractObjective; target: number; rewardXp: number };
}

// Pools are restricted to things a player can plausibly find on ordinary streets.
const DAILY_MANUFACTURERS = [
  'toyota',
  'honda',
  'ford',
  'chevrolet',
  'volkswagen',
  'bmw',
  'mercedes-benz',
  'hyundai',
  'kia',
  'nissan',
  'tesla',
  'jeep',
  'mazda',
  'subaru',
  'audi',
];
const DAILY_COUNTRIES: CountryCode[] = ['JP', 'DE', 'US', 'KR'];
const DAILY_CATEGORIES: VehicleCategory[] = ['suv', 'sedan', 'pickup', 'hatchback'];
const WEEKLY_CATEGORIES: VehicleCategory[] = ['sports', 'coupe', 'offroad', 'wagon', 'suv', 'pickup'];
const WEEKLY_MANUFACTURERS = [...DAILY_MANUFACTURERS, 'porsche', 'land-rover', 'mini', 'lexus', 'dodge'];

const DAILY_TEMPLATES: Template[] = [
  {
    key: 'spot_any',
    build: (r) => {
      const target = 3 + Math.floor(r() * 3);
      return { objective: { kind: 'spot_any' }, target, rewardXp: 40 * target };
    },
  },
  {
    key: 'new_discovery',
    build: () => ({ objective: { kind: 'new_discovery' }, target: 1, rewardXp: 150 }),
  },
  {
    key: 'spot_manufacturer',
    build: (r) => ({
      objective: { kind: 'spot_manufacturer', manufacturerId: pick(r, DAILY_MANUFACTURERS) },
      target: 1 + Math.floor(r() * 2),
      rewardXp: 125,
    }),
  },
  {
    key: 'spot_country',
    build: (r) => ({
      objective: { kind: 'spot_country', country: pick(r, DAILY_COUNTRIES) },
      target: 2,
      rewardXp: 120,
    }),
  },
  {
    key: 'spot_category',
    build: (r) => ({
      objective: { kind: 'spot_category', category: pick(r, DAILY_CATEGORIES) },
      target: 2,
      rewardXp: 120,
    }),
  },
  {
    key: 'rarity_at_least',
    build: () => ({ objective: { kind: 'rarity_at_least', rarity: 'uncommon' }, target: 1, rewardXp: 175 }),
  },
];

const WEEKLY_TEMPLATES: Template[] = [
  {
    key: 'spot_any',
    build: (r) => {
      const target = 15 + 5 * Math.floor(r() * 2);
      return { objective: { kind: 'spot_any' }, target, rewardXp: 30 * target };
    },
  },
  {
    key: 'new_discovery',
    build: (r) => ({ objective: { kind: 'new_discovery' }, target: 4 + Math.floor(r() * 3), rewardXp: 750 }),
  },
  {
    key: 'rarity_at_least',
    build: () => ({ objective: { kind: 'rarity_at_least', rarity: 'rare' }, target: 1, rewardXp: 800 }),
  },
  {
    key: 'spot_manufacturer',
    build: (r) => ({
      objective: { kind: 'spot_manufacturer', manufacturerId: pick(r, WEEKLY_MANUFACTURERS) },
      target: 3,
      rewardXp: 500,
    }),
  },
  {
    key: 'spot_category',
    build: (r) => ({
      objective: { kind: 'spot_category', category: pick(r, WEEKLY_CATEGORIES) },
      target: 3,
      rewardXp: 500,
    }),
  },
  {
    key: 'distinct_countries',
    build: () => ({ objective: { kind: 'distinct_countries' }, target: 4, rewardXp: 600 }),
  },
  {
    key: 'distinct_manufacturers',
    build: () => ({ objective: { kind: 'distinct_manufacturers' }, target: 6, rewardXp: 600 }),
  },
  {
    key: 'spot_electric',
    build: () => ({ objective: { kind: 'spot_electric' }, target: 3, rewardXp: 450 }),
  },
];

/**
 * Deterministically generates the contracts for the period containing `now`.
 * The same player + period always yields the same contracts, which keeps
 * generation idempotent and server-verifiable for future multiplayer.
 */
export function generateContracts(
  playerId: string,
  period: ContractPeriod,
  now: number,
  config: GameConfig,
): Contract[] {
  const key = periodKey(period, now);
  const rand = seededRandom(`${playerId}|${key}`);
  const templates = period === 'daily' ? DAILY_TEMPLATES : WEEKLY_TEMPLATES;
  const count = period === 'daily' ? config.dailyContractCount : config.weeklyContractCount;
  const chosen = shuffle(rand, templates).slice(0, Math.min(count, templates.length));
  return chosen.map((t, i) => {
    const built = t.build(rand);
    return {
      id: `${key}#${i}:${t.key}`,
      period,
      periodKey: key,
      objective: built.objective,
      target: built.target,
      progress: 0,
      rewardXp: built.rewardXp,
      completedAt: null,
      createdAt: now,
    };
  });
}

/** An encounter counts toward contracts only if it was not a cooldown duplicate. */
export function isQualifying(e: EncounterRecord): boolean {
  return e.xpAwarded > 0;
}

/** Recomputes progress from scratch for the encounters inside the contract's period. */
export function computeContractProgress(
  contract: Contract,
  encounters: EncounterRecord[],
  catalog: Catalog,
): number {
  const anchor = contract.createdAt;
  const start = periodStart(contract.period, anchor);
  const end = periodEnd(contract.period, anchor);
  const inPeriod = encounters.filter(
    (e) => e.createdAt >= start && e.createdAt < end && isQualifying(e),
  );
  const o = contract.objective;
  const vehicleOf = (e: EncounterRecord) => (e.vehicleId ? catalog.getVehicle(e.vehicleId) : undefined);
  let value = 0;
  switch (o.kind) {
    case 'spot_any':
      value = inPeriod.length;
      break;
    case 'new_discovery':
      value = inPeriod.filter((e) => e.isFirstDiscovery).length;
      break;
    case 'spot_manufacturer':
      value = inPeriod.filter((e) => vehicleOf(e)?.manufacturerId === o.manufacturerId).length;
      break;
    case 'spot_country':
      value = inPeriod.filter((e) => {
        const v = vehicleOf(e);
        return v ? catalog.countryOf(v) === o.country : false;
      }).length;
      break;
    case 'spot_category':
      value = inPeriod.filter((e) => vehicleOf(e)?.category === o.category).length;
      break;
    case 'rarity_at_least':
      value = inPeriod.filter((e) => {
        const v = vehicleOf(e);
        return v ? rarityRank(v.rarity) >= rarityRank(o.rarity) : false;
      }).length;
      break;
    case 'spot_electric':
      value = inPeriod.filter((e) => vehicleOf(e)?.electric === true).length;
      break;
    case 'distinct_countries': {
      const set = new Set<string>();
      for (const e of inPeriod) {
        const v = vehicleOf(e);
        if (v) set.add(catalog.countryOf(v));
      }
      value = set.size;
      break;
    }
    case 'distinct_manufacturers': {
      const set = new Set<string>();
      for (const e of inPeriod) {
        const v = vehicleOf(e);
        if (v) set.add(v.manufacturerId);
      }
      value = set.size;
      break;
    }
  }
  return Math.min(contract.target, value);
}

export function describeContract(c: Pick<Contract, 'objective' | 'target'>, catalog: Catalog): string {
  const o = c.objective;
  const n = c.target;
  const plural = (word: string) => (n === 1 ? word : `${word}s`);
  switch (o.kind) {
    case 'spot_any':
      return `Spot ${n} ${plural('vehicle')}`;
    case 'new_discovery':
      return `Make ${n} new ${plural('discovery').replace('discoverys', 'discoveries')}`;
    case 'spot_manufacturer':
      return `Spot ${n} ${catalog.getManufacturer(o.manufacturerId)?.name ?? o.manufacturerId} ${plural('vehicle')}`;
    case 'spot_country':
      return `Spot ${n} ${plural('vehicle')} from ${COUNTRY_NAMES[o.country]}`;
    case 'spot_category':
      return `Spot ${n} ${CATEGORY_LABELS[o.category].toLowerCase()}${n === 1 ? '' : 's'}`;
    case 'rarity_at_least':
      return `Spot ${n} ${RARITY_LABELS[o.rarity]}-or-better ${plural('vehicle')}`;
    case 'spot_electric':
      return `Spot ${n} electric ${plural('vehicle')}`;
    case 'distinct_countries':
      return `Spot vehicles from ${n} different countries`;
    case 'distinct_manufacturers':
      return `Spot vehicles from ${n} different manufacturers`;
  }
}
