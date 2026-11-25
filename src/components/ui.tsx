import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { RARITY_LABELS } from '@/catalog';
import type { Rarity } from '@/domain/types';
import { useHaptics } from '@/state/AppProvider';
import { colors, radius, rarityColors, space, type, type TypeVariant } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

// ── Text ─────────────────────────────────────────────────────────────
interface TxtProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
}

export function Txt({ variant = 'body', color, align, upper, style, children, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[
        type[variant],
        { color: color ?? (variant === 'label' ? colors.textMuted : colors.text) },
        align && { textAlign: align },
        upper && { textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Screen ───────────────────────────────────────────────────────────
interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
}

export function Screen({ children, scroll = true, edges = ['top'], contentStyle, header }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ── Button ───────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function Button({ label, variant = 'primary', icon, loading, disabled, onPress, style, compact, ...rest }: ButtonProps) {
  const haptics = useHaptics();
  const isDisabled = disabled || loading;
  const fg =
    variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.textMuted : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        haptics.selection();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && { backgroundColor: pressed ? '#B3EC2C' : colors.accent },
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.surfacePressed : colors.surfaceRaised,
          borderColor: colors.borderStrong,
          borderWidth: 1,
        },
        variant === 'ghost' && { backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
        variant === 'danger' && {
          backgroundColor: pressed ? 'rgba(255,107,107,0.2)' : colors.dangerSoft,
          borderColor: 'rgba(255,107,107,0.35)',
          borderWidth: 1,
        },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={fg} strokeWidth={2} />}
          <Txt variant="bodyStrong" color={fg} style={{ fontFamily: 'InterTight_600SemiBold' }}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

// ── Panel ────────────────────────────────────────────────────────────
interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Draws the HUD-style corner brackets in the given colour. */
  bracket?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Panel({ children, style, bracket, onPress, accessibilityLabel }: PanelProps) {
  const content = (
    <>
      {bracket && <Brackets color={bracket} />}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.panel, pressed && { backgroundColor: colors.surfacePressed }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.panel, style]}>{content}</View>;
}

export function Brackets({ color, size = 12, inset = -1 }: { color: string; size?: number; inset?: number }) {
  const b = { position: 'absolute' as const, width: size, height: size, borderColor: color };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[b, { top: inset, left: inset, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 }]} />
      <View style={[b, { top: inset, right: inset, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 }]} />
      <View style={[b, { bottom: inset, left: inset, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 }]} />
      <View style={[b, { bottom: inset, right: inset, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 }]} />
    </View>
  );
}

// ── Progress ─────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  color = colors.accent,
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// ── Rarity ───────────────────────────────────────────────────────────
export function RarityBadge({ rarity, size = 'md' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const c = rarityColors[rarity];
  return (
    <View
      accessibilityLabel={`${RARITY_LABELS[rarity]} rarity`}
      style={[
        styles.badge,
        { backgroundColor: c.soft, borderColor: c.line },
        size === 'sm' && { paddingHorizontal: 6, paddingVertical: 2 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Txt variant="label" color={c.fg} style={size === 'sm' ? { fontSize: 10 } : undefined}>
        {RARITY_LABELS[rarity].toUpperCase()}
      </Txt>
    </View>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
  color = colors.accent,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const haptics = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} filter`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[
        styles.chip,
        selected ? { backgroundColor: colors.accentSoft, borderColor: color } : { borderColor: colors.border },
      ]}
    >
      <Txt variant="small" color={selected ? color : colors.textMuted} style={{ fontFamily: 'InterTight_500Medium' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="label" upper accessibilityRole="header">
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <View style={styles.statTile} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Txt variant="label" upper>
        {label}
      </Txt>
      <Txt variant="stat" color={accent ?? colors.text}>
        {value}
      </Txt>
      {sub ? (
        <Txt variant="small" color={colors.textFaint}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.accent} />
      </View>
      <Txt variant="h3" align="center">
        {title}
      </Txt>
      <Txt variant="small" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
        {body}
      </Txt>
      {action}
    </View>
  );
}

export function Notice({ tone = 'info', title, body }: { tone?: 'info' | 'warning' | 'danger'; title: string; body?: string }) {
  const c = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.info;
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : 'rgba(127,178,255,0.10)';
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: c }]} accessibilityRole="alert">
      <Icon name={tone === 'info' ? 'shield' : 'alert'} size={18} color={c} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong" color={c}>
          {title}
        </Txt>
        {body ? (
          <Txt variant="small" color={colors.textMuted}>
            {body}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.md },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  track: { backgroundColor: colors.border, overflow: 'hidden', width: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    paddingHorizontal: 12,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 4,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  notice: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
});
