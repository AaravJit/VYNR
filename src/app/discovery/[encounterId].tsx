import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { catalog, RARITY_LABELS } from '@/catalog';
import { GradientRing } from '@/components/Brand';
import { ContractCard, VehicleEmblem } from '@/components/game';
import { IntelPanel } from '@/components/Intel';
import { Button, Panel, RarityBadge, Screen, SectionHeader, Txt } from '@/components/ui';
import { playSound } from '@/services/sound';
import { useAppState, useHaptics } from '@/state/AppProvider';
import { getOutcome } from '@/state/scanSession';
import { colors, rarityColors, space } from '@/theme/tokens';

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
    const rare = vehicle && vehicle.rarity !== 'common' && vehicle.rarity !== 'uncommon';
    if (first) {
      haptics.success();
      playSound(rare ? 'discoveryRare' : 'discovery', state.settings.soundEnabled);
    } else {
      haptics.impact();
    }
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
        <Button label="Back to scanner" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const levelUp = outcome && outcome.levelAfter.level > outcome.levelBefore.level;
  const total = outcome?.totalXpAwarded ?? encounter.xpAwarded;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingBottom: space.xxxl }}>
      <Animated.View
        style={[
          styles.hero,
          { borderColor: accent },
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
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) }]} />
        <Txt variant="label" color={accent}>
          {vehicle ? (first ? 'NEW DISCOVERY' : `ENCOUNTER #${encounter.encounterIndex + 1}`) : 'FIELD NOTE LOGGED'}
        </Txt>
        {vehicle && (
          <View style={styles.emblem}>
            {first && (
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: glow, transform: [{ rotate: glow.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }]}>
                <GradientRing size={120} stroke={3} />
              </Animated.View>
            )}
            <VehicleEmblem vehicle={vehicle} size={88} />
          </View>
        )}
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
          <Txt variant="display" color={colors.accent} align="center">
            +{total.toLocaleString()} XP
          </Txt>
        </Animated.View>
        {encounter.source === 'simulated' && (
          <Txt variant="label" color={colors.warning}>
            SIMULATED IDENTIFICATION · DEV MODE
          </Txt>
        )}
      </Animated.View>

      {levelUp && outcome && (
        <Panel bracket={colors.accent} style={{ alignItems: 'center', gap: 4 }}>
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
                <Txt variant="mono" color={colors.accent}>
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

      {encounter.intel && <IntelPanel intel={encounter.intel} />}

      <Button label="Continue scanning" icon="scan" onPress={() => router.dismissTo('/')} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: space.xl,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  emblem: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
