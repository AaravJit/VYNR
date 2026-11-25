import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, radius } from '@/theme/tokens';

import { Txt } from './ui';

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduce(r));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** A looping 0→1 value that stops (and rests at 0) when inactive or when Reduce Motion is on. */
function useLoop(active: boolean, duration: number): Animated.Value {
  const [v] = useState(() => new Animated.Value(0));
  const reduce = useReduceMotion();
  useEffect(() => {
    if (!active || reduce) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, reduce, duration, v]);
  return v;
}

const FRAME_H = 230;

/** Four soft corner marks; white when idle, brand pink when the camera is ready. */
function Corners({ color }: { color: string }) {
  const c = { position: 'absolute' as const, width: 28, height: 28, borderColor: color };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[c, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 }]} />
      <View style={[c, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 }]} />
      <View style={[c, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 }]} />
      <View style={[c, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 18 }]} />
    </View>
  );
}

/** A soft gradient band that sweeps across while something is being processed. */
function Sweep({ active, height }: { active: boolean; height: number }) {
  const t = useLoop(active, 1600);
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sweep,
        { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-40, height] }) }] },
      ]}
    >
      <Svg width="100%" height={40}>
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0} />
            <Stop offset="0.85" stopColor={colors.violet} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.blue} stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="40" fill="url(#sweep)" />
      </Svg>
    </Animated.View>
  );
}

/** Camera framing guide. Decorative only; hidden from screen readers. */
export function Viewfinder({ state, hint }: { state: 'starting' | 'ready' | 'busy'; hint: string }) {
  const breathe = useLoop(state === 'ready', 2400);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.wrap}>
        <Animated.View
          style={[
            styles.frame,
            { transform: [{ scale: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.015, 1] }) }] },
          ]}
        >
          <Corners color={state === 'starting' ? 'rgba(255,255,255,0.5)' : state === 'busy' ? colors.violet : colors.accent} />
          <Sweep active={state === 'busy'} height={FRAME_H} />
        </Animated.View>
        <View style={styles.hint}>
          <Txt variant="small" color={colors.text} align="center">
            {hint}
          </Txt>
        </View>
      </View>
    </View>
  );
}

/** Overlay for the captured photo while recognition runs. */
export function AnalysisOverlay({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.analysis]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Sweep active height={320} />
      <View style={styles.analysisLabel}>
        <Txt variant="label" color={colors.text}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

/** Backwards-compatible name used by older screens. */
export const ScanOverlay = ({ label }: { active?: boolean; label: string }) => <AnalysisOverlay label={label} />;

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 140 },
  frame: { width: '86%', height: FRAME_H, overflow: 'hidden', borderRadius: 18 },
  sweep: { position: 'absolute', left: 0, right: 0, height: 40 },
  hint: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
  },
  analysis: { overflow: 'hidden', backgroundColor: 'rgba(11,10,18,0.25)' },
  analysisLabel: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
  },
});
