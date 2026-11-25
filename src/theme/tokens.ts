import type { Rarity } from '@/domain/types';

/**
 * VYNR design tokens: "neon dusk". A deep ink-violet canvas lit by an original
 * pink → violet → blue signal gradient. Soft glass cards, pill controls and a
 * wide display face give VYNR its own identity.
 *
 * Every text colour meets WCAG AA (4.5:1) on `bg`, `surface` and
 * `surfaceRaised`; `test/theme/contrast.test.ts` enforces this.
 */
export const colors = {
  bg: '#0B0716',
  bgDeep: '#06040D',
  surface: '#150F24',
  surfaceRaised: '#1D1531',
  surfacePressed: '#261C3E',
  glass: 'rgba(40,28,68,0.62)',
  border: '#2E2448',
  borderStrong: '#43366A',

  text: '#F7F2FF',
  textMuted: '#BDB2D6',
  textFaint: '#9286B0',

  /** Primary signal colour: hot pink. */
  accent: '#FF4FA3',
  accentPressed: '#E8418F',
  /** Text and icons drawn on top of the accent or the gradient. */
  accentInk: '#16051A',
  accentSoft: 'rgba(255,79,163,0.14)',
  accentLine: 'rgba(255,79,163,0.45)',

  violet: '#A66BFF',
  violetSoft: 'rgba(166,107,255,0.16)',
  violetLine: 'rgba(166,107,255,0.45)',
  blue: '#4DB8FF',
  blueSoft: 'rgba(77,184,255,0.14)',
  blueLine: 'rgba(77,184,255,0.45)',

  danger: '#FF6B81',
  dangerSoft: 'rgba(255,107,129,0.13)',
  dangerLine: 'rgba(255,107,129,0.42)',
  warning: '#FFC861',
  warningSoft: 'rgba(255,200,97,0.12)',
  warningLine: 'rgba(255,200,97,0.45)',
  info: '#4DB8FF',
  infoSoft: 'rgba(77,184,255,0.12)',
  overlay: 'rgba(6,4,13,0.74)',
} as const;

/** The signature gradient, ordered pink → violet → blue. */
export const gradients = {
  signal: ['#FF4FA3', '#A66BFF', '#4DB8FF'],
  /** Muted version for large surfaces behind text. */
  dusk: ['#2A1240', '#1A1233', '#0F1A33'],
  /** Subtle glow at the top of screens. */
  glow: ['rgba(255,79,163,0.20)', 'rgba(166,107,255,0.10)', 'rgba(11,7,22,0)'],
} as const;

export type GradientName = keyof typeof gradients;

export const rarityColors: Record<Rarity, { fg: string; soft: string; line: string }> = {
  common: { fg: '#C6BEDB', soft: 'rgba(198,190,219,0.10)', line: 'rgba(198,190,219,0.34)' },
  uncommon: { fg: '#4FE0D2', soft: 'rgba(79,224,210,0.12)', line: 'rgba(79,224,210,0.40)' },
  rare: { fg: '#5DB2FF', soft: 'rgba(93,178,255,0.14)', line: 'rgba(93,178,255,0.45)' },
  exotic: { fg: '#C08BFF', soft: 'rgba(192,139,255,0.15)', line: 'rgba(192,139,255,0.48)' },
  legendary: { fg: '#FFC24D', soft: 'rgba(255,194,77,0.14)', line: 'rgba(255,194,77,0.50)' },
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
  sm: 8,
  md: 14,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  mono: 'JetBrainsMono_500Medium',
  display: 'Unbounded_800ExtraBold',
  displaySemi: 'Unbounded_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  stat: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
} as const;

export type TypeVariant = keyof typeof type;

export const shadow = {
  glow: {
    shadowColor: '#FF4FA3',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const motion = {
  fast: 140,
  base: 220,
  slow: 420,
} as const;
