import { Text } from 'react-native';

import { fonts } from '@/theme/tokens';

/** Each letter takes one step along the signal gradient, pink → violet → blue. */
const LETTERS: [string, string][] = [
  ['V', '#FF4FA3'],
  ['Y', '#D25DD1'],
  ['N', '#A66BFF'],
  ['R', '#4DB8FF'],
];

/** The VYNR wordmark, set in the display face. */
export function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="VYNR"
      maxFontSizeMultiplier={1.2}
      style={{ fontFamily: fonts.display, fontSize: height, lineHeight: height * 1.2, letterSpacing: height * 0.06 }}
    >
      {LETTERS.map(([l, c]) => (
        <Text key={l} style={{ color: c }}>
          {l}
        </Text>
      ))}
    </Text>
  );
}
