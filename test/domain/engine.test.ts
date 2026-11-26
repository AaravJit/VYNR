import { applyEncounter, type EncounterInput, missingContracts, UNKNOWN_XP_DAILY_CAP } from '@/domain/engine';
import type { GameSnapshot } from '@/domain/types';

import { config, DAY, emptySnapshot, HOUR, idFactory, smallCatalog, T0 } from '../helpers/fixtures';

const cat = smallCatalog();
const input = (vehicleId: string | null, now: number, extra: Partial<EncounterInput> = {}): EncounterInput => ({
  vehicleId,
  label: null,
  source: 'manual',
  confidence: null,
  provider: null,
  photoUri: null,
  now,
  ...extra,
});

/** Applies encounters in sequence, folding each outcome into the snapshot like the repository would. */
function play(inputs: EncounterInput[], start: GameSnapshot = emptySnapshot()) {
  const newId = idFactory();
  let snap = start;
  const outcomes = [];
  for (const i of inputs) {
    const o = applyEncounter(snap, i, cat, config, newId);
    const contracts = new Map(snap.contracts.map((c) => [c.id, c]));
    for (const c of o.contracts) contracts.set(c.id, c);
    snap = {
      ...snap,
      totalXp: snap.totalXp + o.totalXpAwarded,
      encounters: [...snap.encounters, o.encounter],
      contracts: [...contracts.values()],
      awards: [...snap.awards, ...o.awards],
    };
    outcomes.push(o);
  }
  return { snap, outcomes };
}

describe('applyEncounter', () => {
  it('awards full rarity XP for a first discovery', () => {
    const { outcomes } = play([input('b1', T0)]);
    const o = outcomes[0]!;
    expect(o.encounter.isFirstDiscovery).toBe(true);
    expect(o.encounter.xpAwarded).toBe(250);
    expect(o.lineItems[0]).toMatchObject({ reason: 'encounter', amount: 250 });
  });

  it('diminishes repeat rewards and enforces the cooldown', () => {
    const { outcomes } = play([
      input('b1', T0),
      input('b1', T0 + 5 * 60_000), // inside 10 min cooldown
      input('b1', T0 + HOUR),
      input('b1', T0 + 2 * HOUR),
      input('b1', T0 + 3 * HOUR),
    ]);
    expect(outcomes.map((o) => o.encounter.xpAwarded)).toEqual([250, 0, 50, 25, 25]);
    // cooldown duplicate still counts as an encounter index (history is complete)
    expect(outcomes.map((o) => o.encounter.encounterIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects vehicle ids that are not in the catalog', () => {
    expect(() => applyEncounter(emptySnapshot(), input('nope', T0), cat, config, idFactory())).toThrow(/not in the catalog/);
  });

  it('logs unknown vehicles with a capped daily reward', () => {
    const inputs = Array.from({ length: UNKNOWN_XP_DAILY_CAP + 2 }, (_, i) => input(null, T0 + i * 1000, { label: `Mystery ${i}` }));
    const { outcomes, snap } = play(inputs);
    const xp = outcomes.map((o) => o.encounter.xpAwarded);
    expect(xp.slice(0, UNKNOWN_XP_DAILY_CAP).every((x) => x === config.unknownVehicleXp)).toBe(true);
    expect(xp.slice(UNKNOWN_XP_DAILY_CAP)).toEqual([0, 0]);
    expect(snap.encounters.every((e) => e.vehicleId === null && !e.isFirstDiscovery)).toBe(true);
    // Next day the cap resets
    const next = applyEncounter(snap, input(null, T0 + DAY), cat, config, idFactory('x'));
    expect(next.encounter.xpAwarded).toBe(config.unknownVehicleXp);
  });

  it('grants each achievement exactly once', () => {
    const { outcomes } = play([input('a1', T0), input('a1', T0 + HOUR)]);
    expect(outcomes[0]!.awards.map((a) => a.key)).toContain('achievement:first_contact');
    expect(outcomes[1]!.awards.map((a) => a.key)).not.toContain('achievement:first_contact');
  });

  it('awards manufacturer completion and collection milestones once', () => {
    const { outcomes, snap } = play([input('a1', T0), input('a2', T0 + 1000), input('a3', T0 + 2000), input('b1', T0 + 3000)]);
    const keys = outcomes.flatMap((o) => o.awards.map((a) => a.key));
    expect(keys.filter((k) => k === 'manufacturer:alpha')).toHaveLength(1);
    expect(keys.filter((k) => k === 'manufacturer:beta')).toHaveLength(1);
    // 4-vehicle catalog: 25%, 50%, 75%, 100% thresholds are crossed in order
    expect(outcomes[0]!.awards.map((a) => a.key)).toEqual(expect.arrayContaining(['milestone:10', 'milestone:25']));
    expect(keys).toEqual(expect.arrayContaining(['milestone:50', 'milestone:75', 'milestone:100']));
    expect(new Set(keys).size).toBe(keys.length);
    expect(snap.awards).toHaveLength(keys.length);
  });

  it('keeps total XP equal to the sum of the ledger', () => {
    const { outcomes, snap } = play([input('a1', T0), input('a3', T0 + 1000), input('a3', T0 + HOUR), input('b1', T0 + 2 * HOUR)]);
    const ledgerSum = outcomes.flatMap((o) => o.ledger).reduce((s, l) => s + l.amount, 0);
    expect(snap.totalXp).toBe(ledgerSum);
    expect(outcomes.flatMap((o) => o.ledger).every((l) => l.amount > 0)).toBe(true);
  });

  it('reports level changes', () => {
    const { outcomes } = play([input('a3', T0)]);
    expect(outcomes[0]!.levelBefore.level).toBe(1);
    expect(outcomes[0]!.levelAfter.level).toBeGreaterThan(1);
  });

  it('generates contracts for the current periods and completes them with a reward', () => {
    const snap = emptySnapshot('contract-player');
    const generated = missingContracts(snap.playerId, [], T0, config);
    expect(generated.length).toBe(config.dailyContractCount + config.weeklyContractCount);
    // Force a known contract to test completion.
    const spotOne = { ...generated[0]!, objective: { kind: 'spot_any' as const }, target: 1, rewardXp: 123 };
    const { outcomes } = play([input('a1', T0)], { ...snap, contracts: [spotOne, ...generated.slice(1)] });
    const o = outcomes[0]!;
    expect(o.completedContracts.map((c) => c.id)).toContain(spotOne.id);
    expect(o.lineItems).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'contract', amount: 123 })]));
  });

  it('does not complete an already completed contract twice', () => {
    const snap = emptySnapshot();
    const [c] = missingContracts(snap.playerId, [], T0, config);
    const one = { ...c!, objective: { kind: 'spot_any' as const }, target: 1, rewardXp: 77 };
    const { outcomes } = play([input('a1', T0), input('b1', T0 + 1000)], { ...snap, contracts: [one] });
    const rewards = outcomes.flatMap((o) => o.lineItems).filter((l) => l.refId === one.id);
    expect(rewards).toHaveLength(1);
  });

  it('is deterministic for identical inputs', () => {
    const run = () => play([input('a1', T0), input('b1', T0 + HOUR), input('a1', T0 + 2 * HOUR)]).outcomes.map((o) => o.lineItems);
    expect(run()).toEqual(run());
  });
});
