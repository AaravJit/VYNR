import { GAME_CONFIG } from '@/domain/config';
import { duplicateMultiplier, encounterXp, levelInfo, xpForLevel } from '@/domain/progression';

describe('rarity XP table', () => {
  it('matches the specified rewards', () => {
    expect(GAME_CONFIG.rarityXp).toEqual({ common: 25, uncommon: 75, rare: 250, exotic: 750, legendary: 1500 });
  });
});

describe('level curve', () => {
  it('starts at level 1 with 0 XP and is strictly increasing', () => {
    expect(xpForLevel(1, GAME_CONFIG)).toBe(0);
    for (let l = 2; l <= GAME_CONFIG.level.maxLevel; l++) {
      expect(xpForLevel(l, GAME_CONFIG)).toBeGreaterThan(xpForLevel(l - 1, GAME_CONFIG));
    }
  });

  it('computes level boundaries exactly', () => {
    const l2 = xpForLevel(2, GAME_CONFIG);
    expect(levelInfo(l2 - 1, GAME_CONFIG).level).toBe(1);
    expect(levelInfo(l2, GAME_CONFIG).level).toBe(2);
    expect(levelInfo(l2, GAME_CONFIG).xpIntoLevel).toBe(0);
  });

  it('reports progress within a level', () => {
    const info = levelInfo(150, GAME_CONFIG); // L2 = 100, L3 = round(100 * 2^1.5) = 283
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(50);
    expect(info.xpForNext).toBe(183);
    expect(info.progress).toBeCloseTo(50 / 183);
  });

  it('caps at max level', () => {
    const info = levelInfo(10_000_000, GAME_CONFIG);
    expect(info.level).toBe(GAME_CONFIG.level.maxLevel);
    expect(info.isMax).toBe(true);
    expect(info.progress).toBe(1);
  });

  it('treats negative or fractional XP safely', () => {
    expect(levelInfo(-50, GAME_CONFIG).level).toBe(1);
    expect(levelInfo(99.9, GAME_CONFIG).totalXp).toBe(99);
  });
});

describe('duplicate rewards', () => {
  it('diminish with each encounter and floor at the last multiplier', () => {
    expect([0, 1, 2, 3, 4, 50].map((i) => duplicateMultiplier(i, GAME_CONFIG))).toEqual([1, 0.4, 0.2, 0.1, 0.1, 0.1]);
  });

  it('gives full XP for a first discovery', () => {
    expect(encounterXp('rare', 0, null, GAME_CONFIG)).toMatchObject({ amount: 250, multiplier: 1, onCooldown: false });
  });

  it('gives diminished XP for repeats outside the cooldown', () => {
    const hour = 60 * 60 * 1000;
    expect(encounterXp('rare', 1, hour, GAME_CONFIG).amount).toBe(100);
    expect(encounterXp('common', 3, hour, GAME_CONFIG).amount).toBe(2);
    expect(encounterXp('legendary', 9, hour, GAME_CONFIG).amount).toBe(150);
  });

  it('gives zero XP inside the duplicate cooldown', () => {
    const r = encounterXp('legendary', 1, 60_000, GAME_CONFIG);
    expect(r).toMatchObject({ amount: 0, onCooldown: true });
  });

  it('never rounds a positive reward down to zero', () => {
    const cfg = { ...GAME_CONFIG, duplicateMultipliers: [1, 0.001] };
    expect(encounterXp('common', 1, 3_600_000, cfg).amount).toBe(1);
  });
});
