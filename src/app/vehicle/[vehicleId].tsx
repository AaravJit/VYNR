import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalog } from '@/catalog';
import { VehicleEmblem } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, Panel, RarityBadge, Screen, SectionHeader, StatTile, Txt } from '@/components/ui';
import { VehicleFacts } from '@/components/VehicleFacts';
import type { EncounterSource } from '@/domain/types';
import { useAppState } from '@/state/AppProvider';
import { colors, radius, space } from '@/theme/tokens';

const SOURCE_LABEL: Record<EncounterSource, string> = {
  ai_confirmed: 'AI prediction confirmed',
  ai_corrected: 'Corrected by you',
  manual: 'Identified manually',
  simulated: 'Simulated (dev mode)',
};

export default function VehicleDetail() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const state = useAppState();
  const vehicle = vehicleId ? catalog.getVehicle(vehicleId) : undefined;
  const encounters = useMemo(
    () => state.encounters.filter((e) => e.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt),
    [state.encounters, vehicleId],
  );
  const photo = encounters.find((e) => e.photoUri)?.photoUri;

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/garage'))}
        style={styles.back}
      >
        <Icon name="chevron-left" size={22} />
      </Pressable>
    </View>
  );

  if (!vehicle) {
    return (
      <Screen header={header}>
        <EmptyState icon="alert" title="Vehicle not found" body="This vehicle is not in the current catalog." />
      </Screen>
    );
  }

  const discovered = encounters.length > 0;
  const totalXp = encounters.reduce((s, e) => s + e.xpAwarded, 0);
  const first = encounters[encounters.length - 1];

  return (
    <Screen header={header} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <VehicleEmblem vehicle={vehicle} size={72} locked={!discovered} />
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="h1">{discovered ? catalog.displayName(vehicle) : 'Undiscovered'}</Txt>
          <Txt variant="small" color={colors.textMuted}>
            {vehicle.generation}
          </Txt>
          <RarityBadge rarity={vehicle.rarity} />
        </View>
      </View>

      {photo && (
        <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityLabel="Your photo of this vehicle" />
      )}

      {discovered ? (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <StatTile label="Encounters" value={String(encounters.length)} />
            <StatTile label="XP earned" value={totalXp.toLocaleString()} accent={colors.accent} />
          </View>
          {first && (
            <Txt variant="small" color={colors.textMuted}>
              First discovered {new Date(first.createdAt).toLocaleDateString()}
            </Txt>
          )}
          <VehicleFacts vehicle={vehicle} />
          <SectionHeader title="Encounter history" />
          {encounters.map((e) => (
            <Panel key={e.id} style={styles.enc}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="bodyStrong">
                  {e.isFirstDiscovery ? 'First discovery' : `Encounter #${e.encounterIndex + 1}`}
                </Txt>
                <Txt variant="small" color={colors.textMuted}>
                  {new Date(e.createdAt).toLocaleString()} · {SOURCE_LABEL[e.source]}
                  {e.confidence !== null ? ` · ${Math.round(e.confidence * 100)}%` : ''}
                </Txt>
              </View>
              <Txt variant="mono" color={e.xpAwarded > 0 ? colors.accent : colors.textFaint}>
                +{e.xpAwarded}
              </Txt>
            </Panel>
          ))}
        </>
      ) : (
        <EmptyState
          icon="lock"
          title="Not discovered yet"
          body="Find and photograph this vehicle to unlock its record."
          action={<Button label="Open scanner" icon="scan" onPress={() => router.push('/scan')} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { height: 200, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  enc: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
