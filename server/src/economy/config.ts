import { type Rarity, RARITIES, rarityRank, type ServerCatalog, type ServerVehicle } from './catalog.ts';

/**
 * Every economy number lives here so it can be tuned (and simulated, see
 * scripts/simulate-economy.ts) without code changes. Values are first drafts
 * chosen by simulation, documented in docs/ECONOMY.md, and are not final.
 *
 * VYNR Credits (VC) are a closed loop: earned in the game only, never sold,
 * never withdrawn or converted to money, and never granted for a subscription.
 */
export type RarityTable<T> = Record<Rarity, T>;

/** Which catalog vehicles a crate can contain. Pools are filters, so new catalog entries join automatically. */
export interface PoolFilter {
  countries?: string[];
  categories?: string[];
  rarities?: Rarity[];
  minRarity?: Rarity;
  /** Generation ended in or before this year. */
  endedBy?: number;
  manufacturers?: string[];
}

export interface CrateConfig {
  id: string;
  name: string;
  description: string;
  priceVc: number;
  pool: PoolFilter;
  /** Relative weight of each rarity. Rarities with no vehicle in the pool are dropped and the rest renormalised. */
  weights: Partial<RarityTable<number>>;
  /** Guarantee: after `after` openings of this crate without `minRarity` or better, the next one is at least that rarity. */
  pity: { after: number; minRarity: Rarity } | null;
  /** Availability window (ms since epoch). Null means always available. */
  availableFrom: number | null;
  availableUntil: number | null;
  /** Season edition applied to collectibles from this crate, if any. */
  edition: string | null;
  enabled: boolean;
}

export interface CosmeticConfig {
  id: string;
  kind: 'scanner_skin' | 'garage_environment' | 'frame' | 'title';
  name: string;
  /** VC price when sold in the shop, otherwise null. */
  priceVc: number | null;
  /** Included with VYNR Black while the subscription is active. Never sold for VC as well. */
  black: boolean;
  /** Granted by a season tier, if any. */
  season: string | null;
}

export interface SeasonTier {
  tier: number;
  xp: number;
  free: { vc?: number; cosmetic?: string } | null;
  /** Premium (VYNR Black) rewards are cosmetic only: never VC, crates or odds. */
  premium: { cosmetic: string } | null;
}

export interface SeasonConfig {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  /** Discoveries of vehicles matching this filter earn double season XP. */
  theme: PoolFilter;
  tiers: SeasonTier[];
}

export interface AchievementConfig {
  id: string;
  /** Discovery achievements count only verified real-world discoveries; ownership achievements count inventory. */
  track: 'discovery' | 'ownership';
  name: string;
  description: string;
  rewardVc: number;
  rule:
    | { kind: 'discoveries'; count: number }
    | { kind: 'distinct_vehicles'; count: number }
    | { kind: 'distinct_makes'; count: number }
    | { kind: 'distinct_countries'; count: number }
    | { kind: 'discovered_rarity'; rarity: Rarity }
    | { kind: 'owned'; count: number }
    | { kind: 'owned_distinct_makes'; count: number }
    | { kind: 'pool_complete'; pool: PoolFilter };
}

export interface EconomyConfig {
  /** First verified discovery of a vehicle by this player. */
  discoveryVc: RarityTable<number>;
  /** Later verified discoveries of a vehicle the player has already found. */
  repeatDiscoveryVc: RarityTable<number>;
  discoveryXp: RarityTable<number>;
  /** Rewarded discoveries per UTC day (more are recorded but earn nothing). */
  dailyRewardedDiscoveries: number;
  /** Rewarded repeat discoveries of the same vehicle per UTC day. */
  dailyRepeatsPerVehicle: number;
  /** A cloud answer can be claimed for this long after it was returned. */
  claimWindowMs: number;
  /** Deterministic alternative to crates: buy a chosen vehicle outright. */
  showroomVc: RarityTable<number>;
  /** VC returned for scrapping a collectible (removes it from circulation). */
  scrapVc: RarityTable<number>;
  market: {
    /** Fee charged to the seller, burned (removed from circulation). */
    feeRate: number;
    /** Listing price bounds per rarity, to stop VC being moved between accounts with junk sales. */
    priceBounds: RarityTable<{ min: number; max: number }>;
    /** New collectibles cannot be listed until this long after they were acquired. */
    tradeHoldMs: number;
    maxActiveListings: number;
    maxListingsPerDay: number;
  };
  crates: CrateConfig[];
  cosmetics: CosmeticConfig[];
  seasons: SeasonConfig[];
  achievements: AchievementConfig[];
  colours: string[];
  /** Showcase slots on a public profile. */
  showcaseSlots: { free: number; black: number };
}

const DAY = 86_400_000;

export const DEFAULT_ECONOMY: EconomyConfig = {
  discoveryVc: { common: 40, uncommon: 70, rare: 140, exotic: 300, legendary: 600 },
  repeatDiscoveryVc: { common: 6, uncommon: 10, rare: 20, exotic: 40, legendary: 80 },
  discoveryXp: { common: 20, uncommon: 35, rare: 70, exotic: 150, legendary: 300 },
  dailyRewardedDiscoveries: 25,
  dailyRepeatsPerVehicle: 2,
  claimWindowMs: 30 * 60_000,
  showroomVc: { common: 180, uncommon: 360, rare: 900, exotic: 2600, legendary: 7500 },
  scrapVc: { common: 10, uncommon: 20, rare: 50, exotic: 150, legendary: 400 },
  market: {
    feeRate: 0.05,
    priceBounds: {
      common: { min: 20, max: 600 },
      uncommon: { min: 40, max: 1200 },
      rare: { min: 100, max: 3000 },
      exotic: { min: 300, max: 9000 },
      legendary: { min: 800, max: 25000 },
    },
    tradeHoldMs: DAY,
    maxActiveListings: 25,
    maxListingsPerDay: 20,
  },
  crates: [
    crate('street', 'Street', 'Everyday cars from every market.', 150, {
      categories: ['sedan', 'hatchback', 'suv', 'pickup', 'wagon', 'van'],
      rarities: ['common', 'uncommon', 'rare'],
    }, { common: 70, uncommon: 25, rare: 5 }, { after: 15, minRarity: 'rare' }),
    crate('performance', 'Performance', 'Sports cars and coupes.', 320, { categories: ['sports', 'coupe', 'convertible'] }, {
      uncommon: 55,
      rare: 33,
      exotic: 10,
      legendary: 2,
    }, { after: 10, minRarity: 'exotic' }),
    crate('jdm', 'JDM Legends', 'Performance icons from Japan.', 360, {
      countries: ['JP'],
      categories: ['sports', 'supercar', 'coupe', 'convertible', 'hatchback'],
      minRarity: 'uncommon',
    }, { uncommon: 50, rare: 35, exotic: 12, legendary: 3 }, { after: 10, minRarity: 'exotic' }),
    crate('autobahn', 'Autobahn', 'German performance and grand touring.', 360, {
      countries: ['DE'],
      categories: ['sports', 'coupe', 'sedan', 'supercar', 'hypercar', 'wagon'],
      minRarity: 'uncommon',
    }, { uncommon: 50, rare: 35, exotic: 12, legendary: 3 }, { after: 10, minRarity: 'exotic' }),
    crate('muscle', 'American Muscle', 'American coupes, sports cars and trucks.', 360, {
      countries: ['US'],
      categories: ['coupe', 'sports', 'supercar', 'pickup'],
      minRarity: 'uncommon',
    }, { uncommon: 55, rare: 32, exotic: 10, legendary: 3 }, { after: 10, minRarity: 'exotic' }),
    crate('heritage', 'Heritage', 'Generations that have ended production.', 400, { endedBy: 2010 }, {
      common: 30,
      uncommon: 35,
      rare: 22,
      exotic: 10,
      legendary: 3,
    }, { after: 10, minRarity: 'exotic' }),
    crate('exotic', 'Exotic', 'Supercars and hypercars.', 1000, { minRarity: 'exotic' }, { exotic: 85, legendary: 15 }, {
      after: 8,
      minRarity: 'legendary',
    }),
    crate('unicorn', 'Unicorn', 'Legendary vehicles only.', 3000, { rarities: ['legendary'] }, { legendary: 100 }, null),
  ],
  cosmetics: [
    cosmetic('env-standard', 'garage_environment', 'Standard garage', 0),
    cosmetic('env-underground', 'garage_environment', 'Underground car park', 900),
    cosmetic('env-workshop', 'garage_environment', 'Motorsport workshop', 1400),
    cosmetic('env-tokyo', 'garage_environment', 'Tokyo-inspired showroom', null, true),
    cosmetic('env-penthouse', 'garage_environment', 'Penthouse', null, true),
    cosmetic('env-museum', 'garage_environment', 'Museum hall', null, false, 'midnight-japan'),
    cosmetic('skin-classic', 'scanner_skin', 'Classic scanner', 0),
    cosmetic('skin-neon', 'scanner_skin', 'Neon scanner', 600),
    cosmetic('skin-midnight', 'scanner_skin', 'Midnight scanner', null, false, 'midnight-japan'),
    cosmetic('skin-black', 'scanner_skin', 'Black scanner', null, true),
    cosmetic('frame-sakura', 'frame', 'Sakura frame', null, false, 'midnight-japan'),
    cosmetic('frame-chrome', 'frame', 'Chrome frame', 500),
    cosmetic('frame-black', 'frame', 'Black frame', null, true),
    cosmetic('title-spotter', 'title', 'Spotter', 0),
    cosmetic('title-night-owl', 'title', 'Night Owl', null, false, 'midnight-japan'),
    cosmetic('title-curator', 'title', 'Curator', 800),
  ],
  seasons: [
    {
      id: 'midnight-japan',
      name: 'Midnight Japan',
      startsAt: Date.UTC(2026, 11, 1),
      endsAt: Date.UTC(2027, 1, 28),
      theme: { countries: ['JP'] },
      tiers: [
        { tier: 1, xp: 100, free: { vc: 100 }, premium: { cosmetic: 'frame-sakura' } },
        { tier: 2, xp: 300, free: { cosmetic: 'title-night-owl' }, premium: null },
        { tier: 3, xp: 600, free: { vc: 200 }, premium: { cosmetic: 'skin-midnight' } },
        { tier: 4, xp: 1000, free: { vc: 250 }, premium: null },
        { tier: 5, xp: 1600, free: { cosmetic: 'env-museum' }, premium: null },
      ],
    },
  ],
  achievements: [
    ach('first-spot', 'discovery', 'First spot', 'Discover your first car.', 50, { kind: 'discoveries', count: 1 }),
    ach('ten-unique', 'discovery', 'Ten of a kind', 'Discover 10 different vehicles.', 200, { kind: 'distinct_vehicles', count: 10 }),
    ach('fifty-unique', 'discovery', 'Spotter', 'Discover 50 different vehicles.', 800, { kind: 'distinct_vehicles', count: 50 }),
    ach('five-makes', 'discovery', 'Brand hopper', 'Discover cars from 5 manufacturers.', 150, { kind: 'distinct_makes', count: 5 }),
    ach('four-countries', 'discovery', 'World tour', 'Discover cars from 4 countries.', 200, { kind: 'distinct_countries', count: 4 }),
    ach('rare-find', 'discovery', 'Rare find', 'Discover a rare vehicle.', 150, { kind: 'discovered_rarity', rarity: 'rare' }),
    ach('exotic-find', 'discovery', 'Exotic sighting', 'Discover an exotic vehicle.', 300, { kind: 'discovered_rarity', rarity: 'exotic' }),
    ach('garage-ten', 'ownership', 'Full garage', 'Own 10 collectibles.', 100, { kind: 'owned', count: 10 }),
    ach('garage-makes', 'ownership', 'Variety', 'Own collectibles from 8 manufacturers.', 150, { kind: 'owned_distinct_makes', count: 8 }),
    ach('jdm-set', 'ownership', 'JDM Legends set', 'Own every vehicle in the JDM Legends pool.', 1000, {
      kind: 'pool_complete',
      pool: { countries: ['JP'], categories: ['sports', 'supercar', 'coupe', 'convertible', 'hatchback'], minRarity: 'uncommon' },
    }),
  ],
  colours: ['Midnight', 'Sakura', 'Ultraviolet', 'Electric Blue', 'Pearl', 'Graphite', 'Signal Red', 'Lime', 'Sunset', 'Silver'],
  showcaseSlots: { free: 6, black: 12 },
};

function crate(
  id: string,
  name: string,
  description: string,
  priceVc: number,
  pool: PoolFilter,
  weights: Partial<RarityTable<number>>,
  pity: CrateConfig['pity'],
): CrateConfig {
  return { id, name, description, priceVc, pool, weights, pity, availableFrom: null, availableUntil: null, edition: null, enabled: true };
}

function cosmetic(
  id: string,
  kind: CosmeticConfig['kind'],
  name: string,
  priceVc: number | null,
  black = false,
  season: string | null = null,
): CosmeticConfig {
  return { id, kind, name, priceVc, black, season };
}

function ach(
  id: string,
  track: AchievementConfig['track'],
  name: string,
  description: string,
  rewardVc: number,
  rule: AchievementConfig['rule'],
): AchievementConfig {
  return { id, track, name, description, rewardVc, rule };
}

export function inPool(catalog: ServerCatalog, v: ServerVehicle, f: PoolFilter): boolean {
  if (f.countries && !f.countries.includes(catalog.countryOf(v))) return false;
  if (f.categories && !f.categories.includes(v.category)) return false;
  if (f.rarities && !f.rarities.includes(v.rarity)) return false;
  if (f.minRarity && rarityRank(v.rarity) < rarityRank(f.minRarity)) return false;
  if (f.endedBy !== undefined && (v.yearEnd === null || v.yearEnd > f.endedBy)) return false;
  if (f.manufacturers && !f.manufacturers.includes(v.manufacturerId)) return false;
  return true;
}

export function poolVehicles(catalog: ServerCatalog, f: PoolFilter): ServerVehicle[] {
  return catalog.vehicles.filter((v) => inPool(catalog, v, f));
}

export interface OddsTable {
  crateId: string;
  /** Probability of each rarity on a normal opening (sums to 1). */
  rarities: { rarity: Rarity; probability: number; vehicles: number }[];
  /** Probability of each individual vehicle on a normal opening (sums to 1). */
  items: { vehicleId: string; rarity: Rarity; probability: number }[];
  pity: CrateConfig['pity'];
}

/**
 * The published odds for a crate, computed from the same config the server
 * draws from. Rarity weights are renormalised over rarities that actually have
 * vehicles in the pool, and each vehicle within a rarity is equally likely.
 */
export function oddsFor(catalog: ServerCatalog, c: CrateConfig): OddsTable {
  const vehicles = poolVehicles(catalog, c.pool);
  const byRarity = new Map<Rarity, ServerVehicle[]>();
  for (const v of vehicles) byRarity.set(v.rarity, [...(byRarity.get(v.rarity) ?? []), v]);
  const live = RARITIES.filter((r) => (c.weights[r] ?? 0) > 0 && (byRarity.get(r)?.length ?? 0) > 0);
  const total = live.reduce((a, r) => a + (c.weights[r] ?? 0), 0);
  const rarities = live.map((r) => ({ rarity: r, probability: (c.weights[r] ?? 0) / total, vehicles: byRarity.get(r)!.length }));
  const items = rarities.flatMap(({ rarity, probability, vehicles: n }) =>
    byRarity.get(rarity)!.map((v) => ({ vehicleId: v.id, rarity, probability: probability / n })),
  );
  return { crateId: c.id, rarities, items, pity: c.pity };
}

/** Validates a config at startup so a bad edit fails loudly instead of misbehaving. */
export function validateEconomy(cfg: EconomyConfig, catalog: ServerCatalog): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of cfg.crates) {
    if (ids.has(c.id)) errors.push(`duplicate crate ${c.id}`);
    ids.add(c.id);
    if (!Number.isInteger(c.priceVc) || c.priceVc <= 0) errors.push(`crate ${c.id}: price must be a positive integer`);
    const odds = oddsFor(catalog, c);
    if (odds.items.length === 0) errors.push(`crate ${c.id}: pool is empty`);
    if (c.pity && !odds.rarities.some((r) => rarityRank(r.rarity) >= rarityRank(c.pity!.minRarity))) {
      errors.push(`crate ${c.id}: pity rarity ${c.pity.minRarity} is not in the pool`);
    }
  }
  const cosmetics = new Set(cfg.cosmetics.map((x) => x.id));
  for (const x of cfg.cosmetics) if (x.black && x.priceVc !== null) errors.push(`cosmetic ${x.id}: Black items are not sold for VC`);
  for (const s of cfg.seasons) {
    const days = (s.endsAt - s.startsAt) / DAY;
    if (days < 60 || days > 92) errors.push(`season ${s.id}: length ${days} days is outside 60–90`);
    for (const t of s.tiers) {
      if (t.free?.cosmetic && !cosmetics.has(t.free.cosmetic)) errors.push(`season ${s.id} tier ${t.tier}: unknown cosmetic`);
      if (t.premium && !cosmetics.has(t.premium.cosmetic)) errors.push(`season ${s.id} tier ${t.tier}: unknown premium cosmetic`);
      if (t.premium && 'vc' in (t.premium as object)) errors.push(`season ${s.id} tier ${t.tier}: premium rewards cannot include VC`);
    }
  }
  if (!(cfg.market.feeRate >= 0 && cfg.market.feeRate < 0.5)) errors.push('market fee must be between 0 and 0.5');
  return errors;
}
