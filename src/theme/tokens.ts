import type { Rarity } from '@/domain/types';

/**
 * VYNR design tokens. Near-black canvas, a single electric-lime signal colour,
 * and a restrained rarity spectrum. All text colours meet WCAG AA (4.5:1) on
 * `bg` and `surface`.
 */
export const colors = {
  bg: '#07080A',
  surface: '#0E1013',
  surfaceRaised: '#14171B',
  surfacePressed: '#1A1E23',
  border: '#22262C',
  borderStrong: '#323840',

  text: '#F2F4F5',
  textMuted: '#A1A9B1',
  textFaint: '#7A838C',

  accent: '#C6FF3D',
  accentInk: '#0A0D04',
  accentSoft: 'rgba(198,255,61,0.12)',
  accentLine: 'rgba(198,255,61,0.35)',

  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.12)',
  warning: '#FFC145',
  warningSoft: 'rgba(255,193,69,0.12)',
  info: '#7FB2FF',
  overlay: 'rgba(7,8,10,0.72)',
} as const;

export const rarityColors: Record<Rarity, { fg: string; soft: string; line: string }> = {
  common: { fg: '#B4BCC4', soft: 'rgba(180,188,196,0.10)', line: 'rgba(180,188,196,0.35)' },
  uncommon: { fg: '#4FD8C4', soft: 'rgba(79,216,196,0.12)', line: 'rgba(79,216,196,0.40)' },
  rare: { fg: '#5B9BFF', soft: 'rgba(91,155,255,0.14)', line: 'rgba(91,155,255,0.45)' },
  exotic: { fg: '#C18CFF', soft: 'rgba(193,140,255,0.14)', line: 'rgba(193,140,255,0.45)' },
  legendary: { fg: '#FFB52E', soft: 'rgba(255,181,46,0.14)', line: 'rgba(255,181,46,0.50)' },
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  stat: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
} as const;

export type TypeVariant = keyof typeof type;

export const motion = {
  fast: 140,
  base: 220,
  slow: 420,
} as const;
