import { useId } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { gradients, type GradientName } from '@/theme/tokens';

type Direction = 'horizontal' | 'vertical' | 'diagonal';

const VECTORS: Record<Direction, { x1: string; y1: string; x2: string; y2: string }> = {
  horizontal: { x1: '0', y1: '0', x2: '1', y2: '0' },
  vertical: { x1: '0', y1: '0', x2: '0', y2: '1' },
  diagonal: { x1: '0', y1: '0', x2: '1', y2: '1' },
};

function stopsFor(colors: readonly string[]) {
  return colors.map((c, i) => (
    <Stop key={`${c}-${i}`} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
  ));
}

/**
 * Fills its parent with a linear gradient. Place inside a View with
 * `overflow: 'hidden'` and a border radius to clip it to a shape.
 */
export function GradientFill({
  name = 'signal',
  colors,
  direction = 'diagonal',
  opacity = 1,
  style,
}: {
  name?: GradientName;
  colors?: readonly string[];
  direction?: Direction;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const stops = colors ?? gradients[name];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }, style]} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" accessibilityElementsHidden>
        <Defs>
          <LinearGradient id={`g${id}`} {...VECTORS[direction]}>
            {stopsFor(stops)}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g${id})`} />
      </Svg>
    </View>
  );
}

/** Soft radial glow, used behind hero elements and at the top of screens. */
export function Glow({ color, size, style }: { color: string; size: number; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} accessibilityElementsHidden>
        <Defs>
          <RadialGradient id={`r${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#r${id})`} />
      </Svg>
    </View>
  );
}

/** A circular progress ring stroked with the signal gradient. */
export function Ring({
  size,
  stroke = 8,
  progress,
  trackColor,
}: {
  size: number;
  stroke?: number;
  progress: number;
  trackColor: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
          {stopsFor(gradients.signal)}
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      {pct > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#ring${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </Svg>
  );
}
