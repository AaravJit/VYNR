import type { Rarity } from '@/domain/types';

/**
 * VYNR design system, "Dusk". An original in-universe phone-app identity:
 * a deep violet-black canvas, translucent glass surfaces, and a restrained
 * pink → violet → blue brand gradient used only for brand moments (logo, the
 * shutter ring, rare reveals). Everything else is quiet. All text colours meet
 * WCAG AA (4.5:1) on `bg` and `surface`. See docs/DESIGN.md.
 */
export const colors = {
  bg: '#0B0A12',
  surface: '#14121E',
  surfaceRaised: '#1B1828',
  surfacePressed: '#242036',
  border: '#272238',
  borderStrong: '#3A3352',
  /** Translucent glass over camera or imagery. */
  glass: 'rgba(16,14,26,0.66)',
  glassStrong: 'rgba(16,14,26,0.86)',
  glassBorder: 'rgba(255,255,255,0.10)',

  text: '#F6F4FB',
  textMuted: '#ADA7C2',
  textFaint: '#8A83A3',

  /** Primary brand colour (pink). */
  accent: '#FF5FA8',
  accentInk: '#1C0713',
  accentSoft: 'rgba(255,95,168,0.14)',
  accentLine: 'rgba(255,95,168,0.42)',
  violet: '#A07BFF',
  violetSoft: 'rgba(160,123,255,0.14)',
  blue: '#55AEFF',
  blueSoft: 'rgba(85,174,255,0.14)',

  danger: '#FF6170',
  dangerSoft: 'rgba(255,97,112,0.12)',
  dangerLine: 'rgba(255,97,112,0.40)',
  warning: '#FFB84D',
  warningSoft: 'rgba(255,184,77,0.12)',
  warningLine: 'rgba(255,184,77,0.45)',
  success: '#5BE3B5',
  info: '#55AEFF',
  infoSoft: 'rgba(85,174,255,0.10)',
  overlay: 'rgba(11,10,18,0.72)',
} as const;

/** The brand gradient, pink → violet → blue. Used sparingly. */
export const brandGradient = [colors.accent, colors.violet, colors.blue] as const;

export const rarityColors: Record<Rarity, { fg: string; soft: string; line: string }> = {
  common: { fg: '#BEB8CF', soft: 'rgba(190,184,207,0.10)', line: 'rgba(190,184,207,0.32)' },
  uncommon: { fg: '#5BE3C8', soft: 'rgba(91,227,200,0.12)', line: 'rgba(91,227,200,0.38)' },
  rare: { fg: '#55AEFF', soft: 'rgba(85,174,255,0.14)', line: 'rgba(85,174,255,0.45)' },
  exotic: { fg: '#B794FF', soft: 'rgba(183,148,255,0.14)', line: 'rgba(183,148,255,0.45)' },
  legendary: { fg: '#FFC861', soft: 'rgba(255,200,97,0.14)', line: 'rgba(255,200,97,0.50)' },
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
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
} as const;

const tabular = { fontVariant: ['tabular-nums' as const] };

/** Compact hierarchy: no oversized headings; labels are small caps, not monospace. */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  mono: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, ...tabular },
  stat: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, ...tabular },
} as const;

export type TypeVariant = keyof typeof type;

export const motion = {
  fast: 140,
  base: 220,
  slow: 420,
} as const;

export const layout = {
  /** Height of the floating tab bar above the home indicator. Content must leave this much room. */
  tabBarHeight: 64,
} as const;
