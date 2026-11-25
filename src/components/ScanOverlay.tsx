import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Brackets, Txt } from './ui';

/** Futuristic targeting reticle with a sweeping scan line. Purely decorative. */
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
          <Brackets color={colors.accent} size={34} inset={0} />
          <Animated.View
            style={[
              styles.line,
              {
                transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 236] }) }],
                opacity: active ? 1 : 0,
              },
            ]}
          />
          <Animated.View
            style={[styles.center, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}
          />
        </View>
        <Txt variant="label" color={colors.accent} align="center" style={{ marginTop: 14 }}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '86%', height: 240, overflow: 'hidden' },
  line: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
});
