import type { PlayerStats } from './stats';

export interface AchievementContext {
  stats: PlayerStats;
  contractsCompleted: number;
}

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  xp: number;
  /** Returns current progress toward `target`. */
  progress: (ctx: AchievementContext) => number;
  target: number;
}

const rareOrBetter = (s: PlayerStats) =>
  s.uniqueByRarity.rare + s.uniqueByRarity.exotic + s.uniqueByRarity.legendary;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_contact',
    title: 'First Contact',
    description: 'Log your first catalogued vehicle.',
    xp: 50,
    target: 1,
    progress: ({ stats }) => stats.uniqueVehicles,
  },
  {
    key: 'collector_10',
    title: 'Collector',
    description: 'Discover 10 different vehicles.',
    xp: 200,
    target: 10,
    progress: ({ stats }) => stats.uniqueVehicles,
  },
  {
    key: 'collector_25',
    title: 'Archivist',
    description: 'Discover 25 different vehicles.',
    xp: 500,
    target: 25,
    progress: ({ stats }) => stats.uniqueVehicles,
  },
  {
    key: 'collector_50',
    title: 'Curator',
    description: 'Discover 50 different vehicles.',
    xp: 1000,
    target: 50,
    progress: ({ stats }) => stats.uniqueVehicles,
  },
  {
    key: 'rare_find',
    title: 'Rare Find',
    description: 'Discover a Rare or better vehicle.',
    xp: 150,
    target: 1,
    progress: ({ stats }) => rareOrBetter(stats),
  },
  {
    key: 'exotic_find',
    title: 'Exotic Signal',
    description: 'Discover an Exotic vehicle.',
    xp: 300,
    target: 1,
    progress: ({ stats }) => stats.uniqueByRarity.exotic,
  },
  {
    key: 'legend_find',
    title: 'Legend Sighted',
    description: 'Discover a Legendary vehicle.',
    xp: 750,
    target: 1,
    progress: ({ stats }) => stats.uniqueByRarity.legendary,
  },
  {
    key: 'globetrotter',
    title: 'Globetrotter',
    description: 'Discover vehicles from all 6 catalogued countries.',
    xp: 400,
    target: 6,
    progress: ({ stats }) => stats.countriesSeen.length,
  },
  {
    key: 'brand_spread',
    title: 'Brand Spread',
    description: 'Discover vehicles from 10 different manufacturers.',
    xp: 300,
    target: 10,
    progress: ({ stats }) => stats.manufacturersSeen,
  },
  {
    key: 'marque_master',
    title: 'Marque Master',
    description: 'Complete every catalogued model from one manufacturer.',
    xp: 250,
    target: 1,
    progress: ({ stats }) => stats.completedManufacturers.length,
  },
  {
    key: 'current_affairs',
    title: 'Current Affairs',
    description: 'Discover 3 different electric vehicles.',
    xp: 150,
    target: 3,
    progress: ({ stats }) => stats.electricUnique,
  },
  {
    key: 'streak_3',
    title: 'On the Hunt',
    description: 'Spot vehicles 3 days in a row.',
    xp: 150,
    target: 3,
    progress: ({ stats }) => stats.longestStreak,
  },
  {
    key: 'streak_7',
    title: 'Relentless',
    description: 'Spot vehicles 7 days in a row.',
    xp: 500,
    target: 7,
    progress: ({ stats }) => stats.longestStreak,
  },
  {
    key: 'field_100',
    title: 'Field Veteran',
    description: 'Log 100 encounters.',
    xp: 500,
    target: 100,
    progress: ({ stats }) => stats.totalEncounters,
  },
  {
    key: 'contractor',
    title: 'Contractor',
    description: 'Complete 10 contracts.',
    xp: 300,
    target: 10,
    progress: ({ contractsCompleted }) => contractsCompleted,
  },
];

export function achievementProgress(def: AchievementDef, ctx: AchievementContext): number {
  return Math.min(def.target, def.progress(ctx));
}

export function isAchievementMet(def: AchievementDef, ctx: AchievementContext): boolean {
  return def.progress(ctx) >= def.target;
}
