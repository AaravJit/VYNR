import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog } from '@/catalog';
import { Wordmark } from '@/components/Brand';
import { ContractCard, DevModeBanner, LevelPanel, VehicleRow } from '@/components/game';
import { Glow, GradientFill } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, Panel, ProgressBar, Screen, SectionHeader, Txt } from '@/components/ui';
import type { VehicleCategory } from '@/domain/types';
import { useAppState, useAppStore } from '@/state/AppProvider';
import { colors, radius, shadow, space } from '@/theme/tokens';

const CAT_TINTS = [colors.accent, colors.violet, colors.blue];

const FEATURED: VehicleCategory[] = ['sports', 'supercar', 'offroad', 'pickup', 'suv', 'hypercar'];

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Home() {
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
        <Wordmark height={26} />
        <DevModeBanner />
      </View>

      <LevelPanel level={state.level} username={state.player?.username ?? ''} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open scanner"
        accessibilityHint="Opens the camera to photograph a vehicle"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [styles.scanCta, pressed && { transform: [{ scale: 0.985 }] }]}
      >
        <GradientFill />
        <Glow color="#FFFFFF" size={220} style={{ right: -70, top: -80, opacity: 0.35 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="label" color={colors.accentInk}>
            SCANNER READY
          </Txt>
          <Txt variant="h1" color={colors.accentInk}>
            Identify a vehicle
          </Txt>
          <Txt variant="small" color={colors.accentInk}>
            Faces and plates are blurred on your phone first.
          </Txt>
        </View>
        <View style={styles.scanIcon}>
          <Icon name="scan" size={30} color={colors.text} strokeWidth={2} />
        </View>
      </Pressable>

      <View style={styles.stats}>
        <View style={[styles.statCard, { flex: 1.4 }]}>
          <Txt variant="label" upper>
            Collection
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Txt variant="stat">{state.stats.completionPercent.toFixed(1)}%</Txt>
            <Txt variant="mono" color={colors.textMuted}>
              {state.stats.uniqueVehicles}/{state.stats.catalogSize}
            </Txt>
          </View>
          <ProgressBar value={state.stats.completionPercent / 100} label="Collection completion" height={6} />
        </View>
        <View style={styles.statCard}>
          <Txt variant="label" upper>
            Sightings
          </Txt>
          <Txt variant="stat" color={colors.blue}>
            {state.stats.totalEncounters.toLocaleString()}
          </Txt>
          <Txt variant="small" color={colors.textFaint}>
            all time
          </Txt>
        </View>
      </View>

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
          action={<Button label="Start scanning" icon="scan" onPress={() => router.push('/scan')} />}
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
        style={styles.catScroll}
      >
        {featured.map(({ cat, total, found }, i) => (
          <Panel
            key={cat}
            style={styles.catTile}
            onPress={() => router.push({ pathname: '/garage', params: { category: cat } })}
            accessibilityLabel={`${CATEGORY_LABELS[cat]}: ${found} of ${total} discovered`}
          >
            <View style={[styles.catSwatch, { backgroundColor: CAT_TINTS[i % CAT_TINTS.length] }]} />
            <Txt variant="h3">{CATEGORY_LABELS[cat]}</Txt>
            <Txt variant="mono" color={colors.textMuted}>
              {found}/{total}
            </Txt>
            <ProgressBar value={total ? found / total : 0} height={4} />
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  scanCta: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.accent,
    ...shadow.glow,
  },
  scanIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: space.sm },
  statCard: {
    flex: 1,
    gap: 6,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  catScroll: { marginHorizontal: -space.lg },
  catRow: { paddingHorizontal: space.lg, gap: space.sm },
  catTile: { width: 148, gap: 6, padding: space.md },
  catSwatch: { width: 22, height: 4, borderRadius: 2, marginBottom: 2 },
});
