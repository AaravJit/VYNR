import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog } from '@/catalog';
import { ContractCard, DevModeBanner, LevelPanel, VehicleRow } from '@/components/game';
import { Button, EmptyState, Panel, ProgressBar, Screen, SectionHeader, Txt } from '@/components/ui';
import type { VehicleCategory } from '@/domain/types';
import { useAppState, useAppStore } from '@/state/AppProvider';
import { colors, space } from '@/theme/tokens';

const FEATURED: VehicleCategory[] = ['sports', 'supercar', 'offroad', 'pickup', 'suv', 'hypercar'];

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Career() {
  const state = useAppState();
  const store = useAppStore();
  const { daily } = useMemo(() => store.currentContracts(), [store, state.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = useMemo(() => [...state.encounters].reverse().slice(0, 4), [state.encounters]);
  const discovered = useMemo(
    () => new Set(state.encounters.map((e) => e.vehicleId).filter((x): x is string => !!x)),
    [state.encounters],
  );
  const featured = useMemo(
    () =>
      FEATURED.map((cat) => {
        const all = catalog.vehicles.filter((v) => v.category === cat);
        return { cat, total: all.length, found: all.filter((v) => discovered.has(v.id)).length };
      }),
    [discovered],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="h1">Career</Txt>
        <DevModeBanner />
      </View>

      <LevelPanel level={state.level} username={state.player?.username ?? ''} />

      <Panel style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt variant="label" upper>
            Collection
          </Txt>
          <Txt variant="mono" color={colors.textMuted}>
            {state.stats.uniqueVehicles}/{state.stats.catalogSize}
          </Txt>
        </View>
        <Txt variant="stat">{state.stats.completionPercent.toFixed(1)}%</Txt>
        <ProgressBar value={state.stats.completionPercent / 100} label="Collection completion" />
      </Panel>

      <SectionHeader
        title="Daily contracts"
        action={<Button label="All" variant="ghost" compact onPress={() => router.push('/contracts')} />}
      />
      {daily.length === 0 ? (
        <Txt variant="small" color={colors.textMuted}>
          New contracts are being generated.
        </Txt>
      ) : (
        daily.map((c) => <ContractCard key={c.id} contract={c} />)
      )}

      <SectionHeader
        title="Recent discoveries"
        action={recent.length > 0 ? <Button label="Garage" variant="ghost" compact onPress={() => router.push('/garage')} /> : null}
      />
      {recent.length === 0 ? (
        <EmptyState
          icon="scan"
          title="No sightings yet"
          body="Photograph a car you see on the street to start your collection."
          action={<Button label="Start scanning" icon="scan" onPress={() => router.navigate('/')} />}
        />
      ) : (
        recent.map((e) => {
          const v = e.vehicleId ? catalog.getVehicle(e.vehicleId) : undefined;
          if (!v) {
            return (
              <Panel key={e.id} style={{ gap: 4 }}>
                <Txt variant="h3">{e.label ?? 'Unidentified vehicle'}</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  Field note · +{e.xpAwarded} XP · {timeAgo(e.createdAt)}
                </Txt>
              </Panel>
            );
          }
          return (
            <VehicleRow
              key={e.id}
              vehicle={v}
              subtitle={`${e.isFirstDiscovery ? 'First discovery' : `Encounter #${e.encounterIndex + 1}`} · +${e.xpAwarded} XP · ${timeAgo(e.createdAt)}`}
              onPress={() => router.push({ pathname: '/vehicle/[vehicleId]', params: { vehicleId: v.id } })}
            />
          );
        })
      )}

      <SectionHeader title="Featured categories" />
      <View style={styles.grid}>
        {featured.map(({ cat, total, found }) => (
          <Panel
            key={cat}
            style={styles.catTile}
            onPress={() => router.push({ pathname: '/garage', params: { category: cat } })}
            accessibilityLabel={`${CATEGORY_LABELS[cat]}: ${found} of ${total} discovered`}
          >
            <Txt variant="bodyStrong">{CATEGORY_LABELS[cat]}</Txt>
            <Txt variant="mono" color={colors.textMuted}>
              {found}/{total}
            </Txt>
            <ProgressBar value={total ? found / total : 0} height={3} />
          </Panel>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catTile: { width: '48.5%', flexGrow: 1, gap: 6, padding: space.md },
});
