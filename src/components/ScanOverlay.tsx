import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, gradients, radius } from '@/theme/tokens';

import { GradientFill } from './Gradient';
import { Txt } from './ui';

/** Rounded viewfinder corners stroked with the signal gradient. */
function Corners() {
  const r = 26;
  const len = 46;
  const w = 1000;
  const h = 1000;
  // Drawn in a 1000×1000 box stretched to the frame; strokes use non-scaling widths.
  const d = [
    `M 2 ${len + r} V ${r + 2} Q 2 2 ${r + 2} 2 H ${len + r}`,
    `M ${w - len - r} 2 H ${w - r - 2} Q ${w - 2} 2 ${w - 2} ${r + 2} V ${len + r}`,
    `M ${w - 2} ${h - len - r} V ${h - r - 2} Q ${w - 2} ${h - 2} ${w - r - 2} ${h - 2} H ${w - len - r}`,
    `M ${len + r} ${h - 2} H ${r + 2} Q 2 ${h - 2} 2 ${h - r - 2} V ${h - len - r}`,
  ].join(' ');
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="reticle" x1="0" y1="0" x2="1" y2="1">
          {gradients.signal.map((c, i) => (
            <Stop key={c} offset={i / (gradients.signal.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Path d={d} stroke="url(#reticle)" strokeWidth={4} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}


/** Rounded gradient viewfinder with a sweeping scan beam. Purely decorative. */
export function ScanOverlay({ active, label }: { active: boolean; label: string }) {
  const [sweep] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce || !active) return;
      loops = [
        Animated.loop(
          Animated.timing(sweep, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ),
      ];
      loops.forEach((l) => l.start());
    });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [active, sweep, pulse]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.frameWrap}>
        <View style={styles.frame}>
          <Corners />
          <Animated.View
            style={[
              styles.line,
              {
                transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [6, 234] }) }],
                opacity: active ? 1 : 0,
              },
            ]}
          >
            <GradientFill direction="horizontal" />
          </Animated.View>
          <Animated.View
            style={[styles.center, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}
          />
        </View>
        <View style={styles.pill}>
          <Txt variant="label" color={colors.text} align="center">
            {label}
          </Txt>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '86%', height: 240, overflow: 'hidden', borderRadius: radius.lg },
  pill: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  line: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: colors.violet,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
});
