import { catalog } from '@/catalog';
import { GAME_CONFIG } from '@/domain/config';
import { computeContractProgress, describeContract, generateContracts } from '@/domain/contracts';
import { periodKey, streaks, weekKey } from '@/domain/time';
import type { Contract, EncounterRecord } from '@/domain/types';

import { DAY, HOUR, T0 } from '../helpers/fixtures';

const enc = (id: string, vehicleId: string | null, createdAt: number, extra: Partial<EncounterRecord> = {}): EncounterRecord => ({
  id,
  vehicleId,
  label: null,
  source: 'manual',
  confidence: null,
  provider: null,
  xpAwarded: 25,
  encounterIndex: 0,
  isFirstDiscovery: true,
  photoUri: null,
  createdAt,
  ...extra,
});

describe('calendar keys', () => {
  it('produces ISO week keys', () => {
    expect(weekKey(Date.UTC(2026, 10, 25))).toBe('2026-W48');
    expect(weekKey(Date.UTC(2021, 0, 3))).toBe('2020-W53'); // Sunday belongs to previous ISO year
    expect(weekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01');
  });

  it('keys daily and weekly periods', () => {
    expect(periodKey('daily', T0)).toBe('D:2026-11-25');
    expect(periodKey('weekly', T0)).toBe('W:2026-W48');
  });

  it('computes current and longest streaks', () => {
    const ts = [T0 - 5 * DAY, T0 - 4 * DAY, T0 - 2 * DAY, T0 - DAY, T0];
    expect(streaks(ts, T0)).toEqual({ current: 3, longest: 3 });
    expect(streaks(ts, T0 + 2 * DAY).current).toBe(0);
    expect(streaks([], T0)).toEqual({ current: 0, longest: 0 });
  });
});

describe('contract generation', () => {
  it('is deterministic for the same player and period', () => {
    const a = generateContracts('p1', 'daily', T0, GAME_CONFIG);
    const b = generateContracts('p1', 'daily', T0 + 3 * HOUR, GAME_CONFIG);
    expect(a.map((c) => [c.id, c.objective, c.target, c.rewardXp])).toEqual(
      b.map((c) => [c.id, c.objective, c.target, c.rewardXp]),
    );
  });

  it('varies between players and periods', () => {
    const ids = (p: string, t: number) => generateContracts(p, 'daily', t, GAME_CONFIG).map((c) => JSON.stringify(c.objective));
    const variants = new Set<string>();
    for (let d = 0; d < 10; d++) variants.add(ids('p1', T0 + d * DAY).join('|'));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('generates the configured counts with positive rewards and unique template kinds', () => {
    const daily = generateContracts('p1', 'daily', T0, GAME_CONFIG);
    const weekly = generateContracts('p1', 'weekly', T0, GAME_CONFIG);
    expect(daily).toHaveLength(GAME_CONFIG.dailyContractCount);
    expect(weekly).toHaveLength(GAME_CONFIG.weeklyContractCount);
    for (const c of [...daily, ...weekly]) {
      expect(c.rewardXp).toBeGreaterThan(0);
      expect(c.target).toBeGreaterThan(0);
      expect(describeContract(c, catalog)).toMatch(/\w/);
    }
    expect(new Set(daily.map((c) => c.id.split(':').pop())).size).toBe(daily.length);
  });

  it('only references manufacturers that exist in the catalog', () => {
    for (let d = 0; d < 60; d++) {
      for (const p of ['daily', 'weekly'] as const) {
        for (const c of generateContracts(`p${d}`, p, T0 + d * DAY, GAME_CONFIG)) {
          if (c.objective.kind === 'spot_manufacturer') {
            expect(catalog.getManufacturer(c.objective.manufacturerId)).toBeDefined();
          }
        }
      }
    }
  });
});

describe('contract progress', () => {
  const base: Omit<Contract, 'objective' | 'target'> = {
    id: 'c',
    period: 'daily',
    periodKey: periodKey('daily', T0),
    progress: 0,
    rewardXp: 100,
    completedAt: null,
    createdAt: T0,
  };

  it('counts only qualifying encounters inside the period', () => {
    const c: Contract = { ...base, objective: { kind: 'spot_any' }, target: 5 };
    const list = [
      enc('1', 'toyota-corolla-e210', T0 - DAY), // yesterday: ignored
      enc('2', 'toyota-corolla-e210', T0),
      enc('3', 'toyota-corolla-e210', T0 + 1000, { xpAwarded: 0 }), // cooldown duplicate: ignored
      enc('4', null, T0 + 2000), // unknown vehicle counts for spot_any
    ];
    expect(computeContractProgress(c, list, catalog)).toBe(2);
  });

  it('matches manufacturer, country, category, rarity, electric and distinct objectives', () => {
    const list = [
      enc('1', 'toyota-corolla-e210', T0),
      enc('2', 'bmw-m3-g80', T0 + 1),
      enc('3', 'tesla-model-3', T0 + 2),
      enc('4', 'ferrari-f40', T0 + 3),
    ];
    const p = (objective: Contract['objective'], target = 10) =>
      computeContractProgress({ ...base, objective, target }, list, catalog);
    expect(p({ kind: 'spot_manufacturer', manufacturerId: 'bmw' })).toBe(1);
    expect(p({ kind: 'spot_country', country: 'US' })).toBe(1);
    expect(p({ kind: 'spot_category', category: 'sedan' })).toBe(3);
    expect(p({ kind: 'rarity_at_least', rarity: 'rare' })).toBe(2);
    expect(p({ kind: 'spot_electric' })).toBe(1);
    expect(p({ kind: 'distinct_countries' })).toBe(4);
    expect(p({ kind: 'distinct_manufacturers' })).toBe(4);
    expect(p({ kind: 'new_discovery' })).toBe(4);
    expect(p({ kind: 'spot_any' }, 2)).toBe(2); // capped at target
  });
});
