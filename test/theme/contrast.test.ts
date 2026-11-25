import { colors, rarityColors } from '@/theme/tokens';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const backgrounds = { bg: colors.bg, surface: colors.surface, surfaceRaised: colors.surfaceRaised };
const textColors = {
  text: colors.text,
  textMuted: colors.textMuted,
  textFaint: colors.textFaint,
  accent: colors.accent,
  violet: colors.violet,
  blue: colors.blue,
  danger: colors.danger,
  warning: colors.warning,
  ...Object.fromEntries(Object.entries(rarityColors).map(([k, v]) => [`rarity.${k}`, v.fg])),
};

describe('design tokens meet WCAG AA for text', () => {
  for (const [bgName, bg] of Object.entries(backgrounds)) {
    for (const [fgName, fg] of Object.entries(textColors)) {
      it(`${fgName} on ${bgName} ≥ 4.5:1`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('ink on every stop of the signal gradient ≥ 4.5:1', () => {
    for (const stop of ['#FF4FA3', '#A66BFF', '#4DB8FF']) {
      expect(contrast(colors.accentInk, stop)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
