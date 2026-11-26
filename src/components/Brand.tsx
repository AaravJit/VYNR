import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { Txt } from './ui';

/**
 * VYNR's original mark: a six-blade camera aperture closing on a centre point,
 * filled with the pink → violet → blue brand gradient. The same geometry is
 * used for the app icon (scripts/generate-icons.py).
 */
export function ApertureMark({ size = 28, mono }: { size?: number; mono?: string }) {
  const blades = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="vynrBrand" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="0.55" stopColor={colors.violet} />
          <Stop offset="1" stopColor={colors.blue} />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={50} r={46} fill="none" stroke={mono ?? 'url(#vynrBrand)'} strokeWidth={7} />
      <G>
        {blades.map((deg) => (
          <Path
            key={deg}
            // One blade: a curved wedge from the rim towards (but not into) the centre.
            d="M50 12 C66 14 78 24 84 38 L58 46 Z"
            fill={mono ?? 'url(#vynrBrand)'}
            opacity={0.92}
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </G>
      <Circle cx={50} cy={50} r={6} fill={mono ?? colors.text} />
    </Svg>
  );
}

/** Mark plus wordmark, used in the scanner header and onboarding. */
export function BrandLockup({ size = 22 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel="VYNR">
      <ApertureMark size={size} />
      <Txt variant="h3" style={{ letterSpacing: 3, fontSize: size * 0.78 }}>
        VYNR
      </Txt>
    </View>
  );
}

/** The brand-gradient ring used around the shutter. */
export function GradientRing({ size, stroke = 4 }: { size: number; stroke?: number }) {
  const r = size / 2 - stroke / 2;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }} accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="vynrRing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="0.55" stopColor={colors.violet} />
          <Stop offset="1" stopColor={colors.blue} />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#vynrRing)" strokeWidth={stroke} fill="none" />
    </Svg>
  );
}
