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
import { colors, fonts, radius, rarityColors, shadow, space, type, type TypeVariant } from '@/theme/tokens';

import { GradientFill, Glow } from './Gradient';
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
  /** Draws the soft pink/violet dusk glow at the top of the screen. */
  glow?: boolean;
}

export function Screen({ children, scroll = true, edges = ['top'], contentStyle, header, glow = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {glow && <ScreenGlow />}
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

function ScreenGlow() {
  return (
    <View pointerEvents="none" style={styles.glowWrap}>
      <Glow color={colors.accent} size={420} style={{ top: -250, left: -150 }} />
      <Glow color={colors.violet} size={380} style={{ top: -210, right: -170 }} />
    </View>
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
        variant === 'primary' && [styles.buttonPrimary, !isDisabled && shadow.glow],
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.surfacePressed : colors.glass,
          borderColor: colors.borderStrong,
          borderWidth: 1,
        },
        variant === 'ghost' && { backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
        variant === 'danger' && {
          backgroundColor: pressed ? 'rgba(255,107,129,0.22)' : colors.dangerSoft,
          borderColor: colors.dangerLine,
          borderWidth: 1,
        },
        pressed && { transform: [{ scale: 0.98 }] },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}
    >
      {({ pressed }) => (
        <>
          {variant === 'primary' && (
            <View style={[StyleSheet.absoluteFill, styles.buttonFill]}>
              <GradientFill direction="horizontal" opacity={pressed ? 0.85 : 1} />
            </View>
          )}
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <>
              {icon && <Icon name={icon} size={18} color={fg} strokeWidth={2} />}
              <Txt variant="bodyStrong" color={fg}>
                {label}
              </Txt>
            </>
          )}
        </>
      )}
    </Pressable>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Wraps the card in a 1.5px pink → violet → blue gradient edge. */
  highlight?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Panel({ children, style, highlight, onPress, accessibilityLabel }: PanelProps) {
  const card = (pressed: boolean) => [styles.panel, pressed && { backgroundColor: colors.surfacePressed }, highlight && styles.panelInner, style];
  const body = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [card(pressed), pressed && { transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={card(false)} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
  if (!highlight) return body;
  return (
    <View style={styles.panelEdge}>
      <GradientFill />
      {body}
    </View>
  );
}

// ── Progress ─────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  color,
  height = 8,
  label,
}: {
  value: number;
  /** A solid colour; omit for the signature gradient. */
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
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: color }}>
        {!color && pct > 0 && <GradientFill direction="horizontal" />}
      </View>
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
  color = colors.text,
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
      style={[styles.chip, selected ? styles.chipSelected : { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      {selected && <GradientFill direction="horizontal" opacity={0.28} />}
      <Txt variant="small" color={selected ? color : colors.textMuted} style={{ fontFamily: fonts.semibold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitle}>
        <View style={styles.sectionTick}>
          <GradientFill direction="vertical" />
        </View>
        <Txt variant="label" upper accessibilityRole="header" color={colors.textMuted}>
          {title}
        </Txt>
      </View>
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
        <GradientFill opacity={0.22} />
        <Icon name={icon} size={28} color={colors.accent} />
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
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.infoSoft;
  const line = tone === 'danger' ? colors.dangerLine : tone === 'warning' ? colors.warningLine : colors.blueLine;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: line }]} accessibilityRole="alert">
      <View style={[styles.noticeIcon, { borderColor: line }]}>
        <Icon name={tone === 'info' ? 'shield' : 'alert'} size={16} color={c} />
      </View>
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
  screenContent: { padding: space.lg, paddingBottom: 140, gap: space.lg },
  glowWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonFill: { borderRadius: radius.pill, overflow: 'hidden' },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.lg },
  panel: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  panelEdge: { borderRadius: radius.lg, padding: 1.5, overflow: 'hidden', ...shadow.card },
  panelInner: { backgroundColor: colors.surface, borderWidth: 0, borderRadius: radius.lg - 1.5 },
  track: { backgroundColor: colors.surfacePressed, overflow: 'hidden', width: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipSelected: { borderColor: colors.accentLine, backgroundColor: colors.surfaceRaised },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTick: { width: 3, height: 14, borderRadius: 2, overflow: 'hidden' },
  statTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 4,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accentLine,
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
  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
