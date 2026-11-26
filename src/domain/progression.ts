import type { GameConfig } from './config';
import type { Rarity } from './types';

/** Cumulative XP required to *reach* `level` (level 1 requires 0). */
export function xpForLevel(level: number, config: GameConfig): number {
  if (level <= 1) return 0;
  const { baseXp, exponent } = config.level;
  return Math.round(baseXp * Math.pow(level - 1, exponent));
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP span of the current level (0 at max level). */
  xpForNext: number;
  /** 0..1 progress to the next level (1 at max level). */
  progress: number;
  isMax: boolean;
}

export function levelInfo(totalXp: number, config: GameConfig): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  const max = config.level.maxLevel;
  let level = 1;
  while (level < max && xp >= xpForLevel(level + 1, config)) level++;
  const isMax = level >= max;
  const floor = xpForLevel(level, config);
  const next = isMax ? floor : xpForLevel(level + 1, config);
  const span = next - floor;
  return {
    level,
    totalXp: xp,
    xpIntoLevel: xp - floor,
    xpForNext: span,
    progress: isMax || span === 0 ? 1 : (xp - floor) / span,
    isMax,
  };
}

export function duplicateMultiplier(encounterIndex: number, config: GameConfig): number {
  const m = config.duplicateMultipliers;
  if (m.length === 0) return 1;
  return m[Math.min(Math.max(0, encounterIndex), m.length - 1)]!;
}

export interface EncounterXp {
  base: number;
  multiplier: number;
  amount: number;
  onCooldown: boolean;
}

/**
 * XP for a catalogued vehicle encounter.
 * @param encounterIndex number of prior encounters of the same vehicle
 * @param msSinceLast milliseconds since the previous encounter of the same vehicle (null if none)
 */
export function encounterXp(
  rarity: Rarity,
  encounterIndex: number,
  msSinceLast: number | null,
  config: GameConfig,
): EncounterXp {
  const base = config.rarityXp[rarity];
  const onCooldown = msSinceLast !== null && msSinceLast < config.duplicateCooldownMs;
  if (onCooldown) return { base, multiplier: 0, amount: 0, onCooldown };
  const multiplier = duplicateMultiplier(encounterIndex, config);
  const amount = multiplier > 0 ? Math.max(1, Math.floor(base * multiplier)) : 0;
  return { base, multiplier, amount, onCooldown };
}
