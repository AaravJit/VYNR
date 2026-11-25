import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { catalog, RARITY_LABELS } from '@/catalog';
import { ContractCard, VehicleEmblem } from '@/components/game';
import { Glow, GradientFill } from '@/components/Gradient';
import { Button, Panel, RarityBadge, Screen, SectionHeader, Txt } from '@/components/ui';
import { useAppState, useHaptics } from '@/state/AppProvider';
import { getOutcome } from '@/state/scanSession';
import { colors, radius, rarityColors, shadow, space } from '@/theme/tokens';

export default function Discovery() {
  const { encounterId } = useLocalSearchParams<{ encounterId: string }>();
  const state = useAppState();
  const haptics = useHaptics();
  const outcome = getOutcome(encounterId);
  const encounter = outcome?.encounter ?? state.encounters.find((e) => e.id === encounterId);
  const vehicle = encounter?.vehicleId ? catalog.getVehicle(encounter.vehicleId) : undefined;
  const first = encounter?.isFirstDiscovery ?? false;
  const accent = vehicle ? rarityColors[vehicle.rarity].fg : colors.accent;

  const [reveal] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!encounter) return;
    if (first) haptics.success();
    else haptics.impact();
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        reveal.setValue(1);
        glow.setValue(1);
        return;
      }
      Animated.sequence([
        Animated.timing(reveal, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [encounter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!encounter) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Txt variant="h2">Encounter not found</Txt>
        <Button label="Back to home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const levelUp = outcome && outcome.levelAfter.level > outcome.levelBefore.level;
  const total = outcome?.totalXpAwarded ?? encounter.xpAwarded;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingBottom: space.xxxl }}>
      <Animated.View
        style={[
          styles.heroEdge,
          {
            opacity: reveal,
            transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          },
        ]}
        accessible
        accessibilityLabel={
          vehicle
            ? `${first ? 'First discovery' : 'Encounter logged'}: ${catalog.displayName(vehicle)}, ${RARITY_LABELS[vehicle.rarity]}. ${total} XP earned.`
            : `Field note logged: ${encounter.label}. ${total} XP earned.`
        }
      >
        <GradientFill />
        <View style={styles.hero}>
        <Animated.View style={[styles.heroGlow, { opacity: glow }]}>
          <Glow color={accent} size={320} />
        </Animated.View>
        <View style={[styles.tag, { borderColor: accent }]}>
        <Txt variant="label" color={accent}>
          {vehicle ? (first ? 'NEW DISCOVERY' : `ENCOUNTER #${encounter.encounterIndex + 1}`) : 'FIELD NOTE LOGGED'}
        </Txt>
        </View>
        {vehicle && <VehicleEmblem vehicle={vehicle} size={104} />}
        <Txt variant="h1" align="center">
          {vehicle ? catalog.displayName(vehicle) : encounter.label}
        </Txt>
        {vehicle && (
          <>
            <Txt variant="small" color={colors.textMuted}>
              {vehicle.generation}
            </Txt>
            <RarityBadge rarity={vehicle.rarity} />
          </>
        )}
        <Animated.View style={{ opacity: glow }}>
          <View style={styles.xpPill}>
            <GradientFill direction="horizontal" />
            <Txt variant="h1" color={colors.accentInk} align="center">
              +{total.toLocaleString()} XP
            </Txt>
          </View>
        </Animated.View>
        {encounter.source === 'simulated' && (
          <Txt variant="label" color={colors.warning}>
            SIMULATED IDENTIFICATION · DEV MODE
          </Txt>
        )}
        </View>
      </Animated.View>

      {levelUp && outcome && (
        <Panel highlight style={{ alignItems: 'center', gap: 4 }}>
          <Txt variant="label" color={colors.accent}>
            LEVEL UP
          </Txt>
          <Txt variant="h1">Level {outcome.levelAfter.level}</Txt>
        </Panel>
      )}

      {outcome && outcome.lineItems.length > 0 && (
        <>
          <SectionHeader title="Reward breakdown" />
          <Panel style={{ gap: space.sm }}>
            {outcome.lineItems.map((li, i) => (
              <View key={`${li.refId}-${i}`} style={styles.line}>
                <Txt variant="small" color={colors.textMuted} style={{ flex: 1 }}>
                  {li.label}
                </Txt>
                <Txt variant="mono" color={colors.violet}>
                  +{li.amount}
                </Txt>
              </View>
            ))}
          </Panel>
        </>
      )}
      {outcome && encounter.xpAwarded === 0 && (
        <Txt variant="small" color={colors.textMuted}>
          {vehicle
            ? 'You logged this vehicle moments ago, so this sighting earns no XP and does not count toward contracts.'
            : 'Daily field-note XP limit reached. The sighting is still recorded.'}
        </Txt>
      )}

      {outcome && outcome.completedContracts.length > 0 && (
        <>
          <SectionHeader title="Contracts completed" />
          {outcome.completedContracts.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </>
      )}

      <Button label="Scan another" icon="scan" onPress={() => router.replace('/scan')} />
      {vehicle && (
        <Button
          label="View in garage"
          variant="secondary"
          onPress={() => {
            router.dismissTo('/');
            router.push({ pathname: '/vehicle/[vehicleId]', params: { vehicleId: vehicle.id } });
          }}
        />
      )}
      <Button label="Done" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroEdge: { marginTop: space.xl, borderRadius: radius.xl, padding: 1.5, overflow: 'hidden', ...shadow.glow },
  hero: {
    padding: space.xl,
    paddingVertical: space.xxl,
    gap: space.md,
    alignItems: 'center',
    borderRadius: radius.xl - 1.5,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  heroGlow: { position: 'absolute', top: -10, alignSelf: 'center', width: 320, height: 320 },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.overlay },
  xpPill: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space.xl, paddingVertical: space.sm, marginTop: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
