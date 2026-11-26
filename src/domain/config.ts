import type { Rarity } from './types';

/**
 * All tunable progression values live here so balancing never requires touching
 * engine logic. Treat this as the single source of truth for game economy.
 */
export interface GameConfig {
  rarityXp: Record<Rarity, number>;
  /**
   * Multiplier applied by encounter index (0 = first discovery). Indexes beyond
   * the end of the array reuse the last value.
   */
  duplicateMultipliers: number[];
  /** Re-encounters of the same vehicle inside this window earn 0 XP and do not count toward contracts. */
  duplicateCooldownMs: number;
  /** XP for logging a vehicle that is not in the catalog. */
  unknownVehicleXp: number;
  level: { baseXp: number; exponent: number; maxLevel: number };
  manufacturerCompletionXp: number;
  collectionMilestones: { percent: number; xp: number }[];
  dailyContractCount: number;
  weeklyContractCount: number;
}

export const GAME_CONFIG: GameConfig = {
  rarityXp: {
    common: 25,
    uncommon: 75,
    rare: 250,
    exotic: 750,
    legendary: 1500,
  },
  duplicateMultipliers: [1, 0.4, 0.2, 0.1],
  duplicateCooldownMs: 10 * 60 * 1000,
  unknownVehicleXp: 10,
  level: { baseXp: 100, exponent: 1.5, maxLevel: 60 },
  manufacturerCompletionXp: 500,
  collectionMilestones: [
    { percent: 10, xp: 250 },
    { percent: 25, xp: 750 },
    { percent: 50, xp: 2000 },
    { percent: 75, xp: 4000 },
    { percent: 100, xp: 10000 },
  ],
  dailyContractCount: 3,
  weeklyContractCount: 3,
};
