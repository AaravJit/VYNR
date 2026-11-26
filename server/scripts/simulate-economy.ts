/**
 * Simulates the VYNR economy with the real server code (EconomyStore on an
 * in-memory database) and synthetic players. Nothing here touches a network
 * or a model: discoveries are drawn from an assumed street-encounter mix.
 *
 *   node scripts/simulate-economy.ts [days=90] [players=240] [seed=1]
 *
 * Writes docs/economy-simulation.json and prints a Markdown summary. The
 * assumptions are listed in ASSUMPTIONS and copied into the report.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadCatalog, type Rarity, RARITIES, type ServerVehicle } from '../src/economy/catalog.ts';
import { DEFAULT_ECONOMY, type EconomyConfig, oddsFor } from '../src/economy/config.ts';
import { EconomyError, EconomyStore, type Rng } from '../src/economy/store.ts';

const DAY = 86_400_000;
const [days = 90, playerCount = 240, seed = 1] = process.argv.slice(2).map(Number);

function seeded(s: number): Rng & { float(): number } {
  let a = s >>> 0;
  const float = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { float, int: (n) => Math.floor(float() * n) };
}

type Archetype = 'new' | 'casual' | 'active' | 'subscriber' | 'farmer';

export const ASSUMPTIONS = {
  /** Share of street sightings by rarity (each vehicle within a rarity equally likely). */
  sightingMix: { common: 0.62, uncommon: 0.24, rare: 0.1, exotic: 0.035, legendary: 0.005 } as Record<Rarity, number>,
  /** Verified discoveries per active day, and probability a player plays on a given day. */
  archetypes: {
    new: { share: 0.15, playDays: 7, dailyChance: 0.8, discoveries: 3 },
    casual: { share: 0.4, playDays: Infinity, dailyChance: 0.3, discoveries: 3 },
    active: { share: 0.25, playDays: Infinity, dailyChance: 0.85, discoveries: 8 },
    subscriber: { share: 0.15, playDays: Infinity, dailyChance: 0.85, discoveries: 8 },
    /** Tries to farm by "discovering" the same common car all day. */
    farmer: { share: 0.05, playDays: Infinity, dailyChance: 1, discoveries: 40 },
  } as Record<Archetype, { share: number; playDays: number; dailyChance: number; discoveries: number }>,
  /** Players keep this much VC in reserve and spend the rest on their favourite crate. */
  reserveVc: 100,
  /** Duplicates are listed at this fraction of the showroom price, jittered ±30%. */
  listAtShowroomFraction: 0.45,
  /** A player buys a wishlist vehicle from the market when it costs at most this share of their balance. */
  maxShareOfBalanceOnMarket: 0.6,
};

interface Player {
  id: string;
  type: Archetype;
  favouriteCrate: string;
  wishlist: Set<string>;
  joinedDay: number;
}

function main() {
  const rng = seeded(seed);
  const catalog = loadCatalog();
  const cfg: EconomyConfig = DEFAULT_ECONOMY;
  const store = new EconomyStore(':memory:', { catalog, config: cfg, rng: seeded(seed + 1) });
  const start = Date.UTC(2026, 11, 1);
  const byRarity = new Map<Rarity, ServerVehicle[]>(RARITIES.map((r) => [r, catalog.vehicles.filter((v) => v.rarity === r)]));
  const sighting = (): ServerVehicle => {
    let roll = rng.float();
    for (const r of RARITIES) {
      roll -= ASSUMPTIONS.sightingMix[r];
      if (roll <= 0) {
        const list = byRarity.get(r)!;
        return list[rng.int(list.length)]!;
      }
    }
    return byRarity.get('common')![0]!;
  };
  const candidates = (v: ServerVehicle) => [{ make: catalog.manufacturer(v.manufacturerId)!.name, model: v.model, confidence: 0.9 }];

  const players: Player[] = [];
  const types = Object.entries(ASSUMPTIONS.archetypes) as [Archetype, (typeof ASSUMPTIONS.archetypes)[Archetype]][];
  const crateIds = cfg.crates.filter((c) => c.priceVc <= 400).map((c) => c.id);
  for (let i = 0; i < playerCount; i++) {
    let roll = rng.float();
    let type: Archetype = 'casual';
    for (const [t, a] of types) {
      roll -= a.share;
      if (roll <= 0) {
        type = t;
        break;
      }
    }
    // New players join throughout the period; everyone else is there from day 0.
    const joinedDay = type === 'new' ? rng.int(Math.max(1, days - 7)) : 0;
    const wishlist = new Set(Array.from({ length: 5 }, () => catalog.vehicles[rng.int(catalog.vehicles.length)]!.id));
    players.push({ id: '', type, favouriteCrate: crateIds[rng.int(crateIds.length)]!, wishlist, joinedDay });
  }

  const weekly: Record<string, unknown>[] = [];
  const counters = { discoveries: 0, rewarded: 0, crates: 0, showroom: 0, listings: 0, purchases: 0, scraps: 0, errors: {} as Record<string, number> };
  const note = (e: unknown) => {
    if (!(e instanceof EconomyError)) throw e;
    counters.errors[e.code] = (counters.errors[e.code] ?? 0) + 1;
  };
  const farmerEarnings: number[] = [];

  for (let day = 0; day < days; day++) {
    const dayStart = start + day * DAY;
    for (const p of players) {
      if (day < p.joinedDay) continue;
      if (!p.id) {
        p.id = store.createAccount(dayStart).accountId;
        if (p.type === 'subscriber') {
          store.upsertEntitlement(
            p.id,
            { platform: 'apple', environment: 'sandbox', productId: 'vynr.black.annual', originalTransactionId: `sim-${p.id}`, state: 'active', expiresAt: start + 400 * DAY },
            dayStart,
          );
        }
      }
      const a = ASSUMPTIONS.archetypes[p.type];
      if (day - p.joinedDay >= a.playDays || rng.float() > a.dailyChance) continue;
      let t = dayStart + 8 * 3_600_000;
      const before = store.balanceOf(p.id);
      const farmTarget = byRarity.get('common')![0]!;
      for (let i = 0; i < a.discoveries; i++) {
        t += 60_000 + rng.int(600_000);
        const v = p.type === 'farmer' ? farmTarget : sighting();
        try {
          const rec = store.recordRecognition(p.id, candidates(v), t);
          const d = store.claimDiscovery(p.id, rec, v.id, t);
          counters.discoveries++;
          if (d.rewardVc > 0) counters.rewarded++;
        } catch (e) {
          note(e);
        }
      }
      if (p.type === 'farmer') farmerEarnings.push(store.balanceOf(p.id) - before);

      // Claim what is complete (once a week is enough).
      if (day % 7 === 6) {
        for (const ach of store.achievements(p.id)) if (ach.complete && !ach.claimed) store.claimAchievement(p.id, ach.id, t);
        for (const s of store.activeSeasons(t)) {
          const prog = store.seasonProgress(p.id, s.id);
          for (const tier of s.tiers) {
            for (const track of ['free', 'premium'] as const) {
              if (prog.xp < tier.xp || (track === 'premium' && (!tier.premium || p.type !== 'subscriber')) || (track === 'free' && !tier.free)) continue;
              if (prog.claims.some((c) => c.tier === tier.tier && c.track === track)) continue;
              try {
                store.claimSeasonTier(p.id, s.id, tier.tier, track, t);
              } catch (e) {
                note(e);
              }
            }
          }
        }
      }
      if (p.type === 'farmer') continue;

      // Market: buy a wishlist vehicle if affordable, list one duplicate.
      t += 60_000;
      const bal = store.balanceOf(p.id);
      for (const vehicleId of p.wishlist) {
        const cheapest = store.searchListings(p.id, { vehicleId, sort: 'price_asc', limit: 1 })[0];
        if (cheapest && cheapest.price <= bal * ASSUMPTIONS.maxShareOfBalanceOnMarket) {
          try {
            store.buyListing(p.id, cheapest.id, cheapest.price, `sim-${p.id}-${t}-${vehicleId}`.slice(0, 64), t);
            counters.purchases++;
            p.wishlist.delete(vehicleId);
          } catch (e) {
            note(e);
          }
          break;
        }
      }
      const inv = store.inventory(p.id);
      const seen = new Set<string>();
      const dup = inv.find((c) => (seen.has(c.vehicleId) ? true : (seen.add(c.vehicleId), false)));
      if (dup && rng.float() < 0.5) {
        const r = catalog.vehicle(dup.vehicleId)!.rarity;
        const b = cfg.market.priceBounds[r];
        const target = Math.round(cfg.showroomVc[r] * ASSUMPTIONS.listAtShowroomFraction * (0.7 + 0.6 * rng.float()));
        try {
          store.createListing(p.id, dup.id, Math.min(b.max, Math.max(b.min, target)), `sim-l-${dup.id}`.slice(0, 64), t);
          counters.listings++;
        } catch (e) {
          note(e);
        }
      } else if (dup && rng.float() < 0.15) {
        try {
          store.scrap(p.id, dup.id, `sim-s-${dup.id}`.slice(0, 64), t);
          counters.scraps++;
        } catch (e) {
          note(e);
        }
      }

      // Spend the surplus on the favourite crate, or the showroom for a wishlist item.
      const crate = cfg.crates.find((c) => c.id === p.favouriteCrate)!;
      while (store.balanceOf(p.id) - ASSUMPTIONS.reserveVc >= crate.priceVc) {
        t += 1000;
        try {
          store.openCrate(p.id, crate.id, `sim-c-${p.id}-${t}`.slice(0, 64), t);
          counters.crates++;
        } catch (e) {
          note(e);
          break;
        }
      }
    }

    if (day % 7 === 6 || day === days - 1) {
      const totals = store.totals();
      const byType: Record<string, { players: number; avgBalance: number; avgOwned: number; avgDiscovered: number; completion: number }> = {};
      for (const type of Object.keys(ASSUMPTIONS.archetypes)) {
        const ps = players.filter((p) => p.type === type && p.id);
        if (!ps.length) continue;
        const stats = ps.map((p) => store.stats(p.id));
        byType[type] = {
          players: ps.length,
          avgBalance: Math.round(ps.reduce((a, p) => a + store.balanceOf(p.id), 0) / ps.length),
          avgOwned: +(stats.reduce((a, s) => a + s.owned, 0) / ps.length).toFixed(1),
          avgDiscovered: +(stats.reduce((a, s) => a + s.distinctVehicles, 0) / ps.length).toFixed(1),
          completion: +((100 * stats.reduce((a, s) => a + s.ownedDistinctVehicles, 0)) / ps.length / catalog.vehicles.length).toFixed(1),
        };
      }
      weekly.push({ day: day + 1, ...totals, byType });
    }
  }

  const sales = store.db.prepare('SELECT l.rarity AS rarity, COUNT(*) AS n, AVG(s.price) AS avg FROM sales s JOIN listings l ON l.id = s.listing_id GROUP BY l.rarity').all() as {
    rarity: string;
    n: number;
    avg: number;
  }[];
  const owned = store.db.prepare('SELECT vehicle_id FROM collectibles WHERE owner_id IS NOT NULL').all() as { vehicle_id: string }[];
  const circulatingByRarity: Record<string, number> = {};
  for (const o of owned) {
    const r = catalog.vehicle(o.vehicle_id)!.rarity;
    circulatingByRarity[r] = (circulatingByRarity[r] ?? 0) + 1;
  }
  const crateEv = cfg.crates.map((c) => {
    const odds = oddsFor(catalog, c);
    const ev = odds.rarities.reduce((a, r) => a + r.probability * cfg.showroomVc[r.rarity], 0);
    return { crate: c.id, price: c.priceVc, showroomValueEv: Math.round(ev), ratio: +(ev / c.priceVc).toFixed(2) };
  });
  const invariants = store.checkInvariants();
  const report = {
    generatedBy: 'server/scripts/simulate-economy.ts',
    params: { days, players: playerCount, seed },
    assumptions: ASSUMPTIONS,
    counters,
    weekly,
    final: weekly[weekly.length - 1],
    marketSalesByRarity: sales.map((s) => ({ rarity: s.rarity, sales: s.n, avgPrice: Math.round(s.avg) })),
    circulatingByRarity,
    crateValue: crateEv,
    farmer: {
      avgVcPerDay: farmerEarnings.length ? Math.round(farmerEarnings.reduce((a, b) => a + b, 0) / farmerEarnings.length) : 0,
      maxVcPerDay: farmerEarnings.length ? Math.max(...farmerEarnings) : 0,
    },
    invariants,
  };
  writeFileSync(join(import.meta.dirname, '..', '..', 'docs', 'economy-simulation.json'), JSON.stringify(report, null, 1) + '\n');

  const f = report.final as { circulating: number; minted: number; spent: number; feesBurned: number; collectibles: number; byType: Record<string, Record<string, number>> };
  const lines = [
    `Simulated ${days} days, ${playerCount} players, seed ${seed}. Invariants: ${invariants.length ? invariants.join('; ') : 'all hold'}.`,
    '',
    `VC minted ${f.minted}, spent ${f.spent} (${Math.round((100 * f.spent) / Math.max(1, f.minted))}% of minted), fees burned ${f.feesBurned}, circulating ${f.circulating}.`,
    `Collectibles in circulation: ${f.collectibles}. Crates opened ${counters.crates}, listings ${counters.listings}, market purchases ${counters.purchases}, scraps ${counters.scraps}.`,
    `Farmer (same car all day): average ${report.farmer.avgVcPerDay} VC per day, max ${report.farmer.maxVcPerDay}.`,
    '',
    '| Player type | Players | Avg balance | Avg owned | Avg distinct discovered | Catalog owned % |',
    '| --- | --- | --- | --- | --- | --- |',
    ...Object.entries(f.byType).map(([t, s]) => `| ${t} | ${s.players} | ${s.avgBalance} | ${s.avgOwned} | ${s.avgDiscovered} | ${s.completion}% |`),
    '',
    '| Crate | Price | Expected showroom value | Ratio |',
    '| --- | --- | --- | --- |',
    ...crateEv.map((c) => `| ${c.crate} | ${c.price} | ${c.showroomValueEv} | ${c.ratio} |`),
    '',
    '| Rarity | Market sales | Average price |',
    '| --- | --- | --- |',
    ...report.marketSalesByRarity.map((s) => `| ${s.rarity} | ${s.sales} | ${s.avgPrice} |`),
    '',
    `Circulating by rarity: ${JSON.stringify(circulatingByRarity)}`,
    `Refused operations (expected, by code): ${JSON.stringify(counters.errors)}`,
  ];
  console.log(lines.join('\n'));
  store.close();
}

main();
