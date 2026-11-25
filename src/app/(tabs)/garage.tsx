import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_LABELS, catalog, COUNTRY_NAMES, RARITY_LABELS, rarityRank } from '@/catalog';
import { VehicleRow } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Chip, EmptyState, Button, ProgressBar, Txt } from '@/components/ui';
import { CATEGORIES, COUNTRIES, RARITIES, type CatalogVehicle, type CountryCode, type Rarity, type VehicleCategory } from '@/domain/types';
import { useAppState } from '@/state/AppProvider';
import { colors, radius, rarityColors, space } from '@/theme/tokens';

type Sort = 'recent' | 'rarity' | 'name' | 'seen';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'name', label: 'A–Z' },
  { key: 'seen', label: 'Most seen' },
];

interface Row {
  vehicle: CatalogVehicle;
  count: number;
  last: number;
  discovered: boolean;
}

export default function Garage() {
  const params = useLocalSearchParams<{ category?: string }>();
  const state = useAppState();
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [maker, setMaker] = useState<string | null>(null);
  const validCategory = (c?: string) =>
    c && (CATEGORIES as readonly string[]).includes(c) ? (c as VehicleCategory) : null;
  const [category, setCategory] = useState<VehicleCategory | null>(() => validCategory(params.category));
  // Adopt a new category when Home links here with a different one (derived-state pattern).
  const [seenParam, setSeenParam] = useState(params.category);
  if (params.category !== seenParam) {
    setSeenParam(params.category);
    setCategory(validCategory(params.category));
  }
  const [sort, setSort] = useState<Sort>('recent');
  const [showLocked, setShowLocked] = useState(false);

  const byVehicle = useMemo(() => {
    const m = new Map<string, { count: number; last: number }>();
    for (const e of state.encounters) {
      if (!e.vehicleId) continue;
      const prev = m.get(e.vehicleId);
      m.set(e.vehicleId, { count: (prev?.count ?? 0) + 1, last: Math.max(prev?.last ?? 0, e.createdAt) });
    }
    return m;
  }, [state.encounters]);

  const makersSeen = useMemo(
    () => catalog.manufacturers.filter((m) => catalog.vehiclesByManufacturer(m.id).some((v) => byVehicle.has(v.id) || showLocked)),
    [byVehicle, showLocked],
  );

  const rows: Row[] = useMemo(() => {
    const ids = new Set(catalog.search(query).map((v) => v.id));
    const list = catalog.vehicles
      .filter((v) => ids.has(v.id))
      .filter((v) => showLocked || byVehicle.has(v.id))
      .filter((v) => !rarity || v.rarity === rarity)
      .filter((v) => !country || catalog.countryOf(v) === country)
      .filter((v) => !maker || v.manufacturerId === maker)
      .filter((v) => !category || v.category === category)
      .map((v) => ({ vehicle: v, count: byVehicle.get(v.id)?.count ?? 0, last: byVehicle.get(v.id)?.last ?? 0, discovered: byVehicle.has(v.id) }));
    const name = (r: Row) => catalog.displayName(r.vehicle);
    list.sort((a, b) => {
      if (a.discovered !== b.discovered) return a.discovered ? -1 : 1;
      switch (sort) {
        case 'recent':
          return b.last - a.last || name(a).localeCompare(name(b));
        case 'rarity':
          return rarityRank(b.vehicle.rarity) - rarityRank(a.vehicle.rarity) || name(a).localeCompare(name(b));
        case 'name':
          return name(a).localeCompare(name(b));
        case 'seen':
          return b.count - a.count || name(a).localeCompare(name(b));
      }
    });
    return list;
  }, [query, showLocked, byVehicle, rarity, country, maker, category, sort]);

  const filtersActive = !!(rarity || country || maker || category || query);
  const s = state.stats;

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <Txt variant="h1">Garage</Txt>
      <View style={styles.statsRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="label" upper>
            Completion
          </Txt>
          <Txt variant="stat">
            {s.uniqueVehicles}
            <Txt variant="h3" color={colors.textFaint}>
              {' '}
              / {s.catalogSize}
            </Txt>
          </Txt>
          <ProgressBar value={s.completionPercent / 100} label="Collection completion" />
        </View>
        <View style={{ gap: 4 }}>
          {RARITIES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: rarityColors[r].fg }} />
              <Txt variant="mono" color={colors.textMuted} style={{ fontSize: 11 }}>
                {s.uniqueByRarity[r]}/{catalog.vehicles.filter((v) => v.rarity === r).length}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your garage"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          accessibilityLabel="Search garage"
          style={styles.input}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SORTS.map((o) => (
          <Chip key={o.key} label={o.label} selected={sort === o.key} onPress={() => setSort(o.key)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {RARITIES.map((r) => (
          <Chip
            key={r}
            label={RARITY_LABELS[r]}
            color={rarityColors[r].fg}
            selected={rarity === r}
            onPress={() => setRarity(rarity === r ? null : r)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {COUNTRIES.map((c) => (
          <Chip key={c} label={COUNTRY_NAMES[c]} selected={country === c} onPress={() => setCountry(country === c ? null : c)} />
        ))}
      </ScrollView>
      {makersSeen.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {makersSeen.map((m) => (
            <Chip key={m.id} label={m.name} selected={maker === m.id} onPress={() => setMaker(maker === m.id ? null : m.id)} />
          ))}
        </ScrollView>
      )}
      {category && (
        <View style={styles.chips}>
          <Chip label={`${CATEGORY_LABELS[category]} ✕`} selected onPress={() => setCategory(null)} />
        </View>
      )}
      <View style={styles.toggle}>
        <Txt variant="small" color={colors.textMuted}>
          Show undiscovered
        </Txt>
        <Switch
          accessibilityLabel="Show undiscovered vehicles"
          value={showLocked}
          onValueChange={setShowLocked}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.vehicle.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.discovered ? (
            <VehicleRow
              vehicle={item.vehicle}
              subtitle={`${item.vehicle.generation} · Seen ${item.count}×`}
              onPress={() => router.push({ pathname: '/vehicle/[vehicleId]', params: { vehicleId: item.vehicle.id } })}
            />
          ) : (
            <VehicleRow vehicle={item.vehicle} locked />
          )
        }
        ListEmptyComponent={
          state.stats.uniqueVehicles === 0 && !showLocked ? (
            <EmptyState
              icon="garage"
              title="Your garage is empty"
              body="Every vehicle you identify is stored here with its full encounter history."
              action={<Button label="Scan a vehicle" icon="scan" onPress={() => router.navigate('/')} />}
            />
          ) : (
            <EmptyState
              icon="search"
              title="No matches"
              body={filtersActive ? 'Try removing a filter or changing your search.' : 'Nothing to show yet.'}
              action={
                filtersActive ? (
                  <Button
                    label="Clear filters"
                    variant="secondary"
                    onPress={() => {
                      setQuery('');
                      setRarity(null);
                      setCountry(null);
                      setMaker(null);
                      setCategory(null);
                    }}
                  />
                ) : undefined
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statsRow: {
    flexDirection: 'row',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontFamily: 'InterTight_500Medium', fontSize: 15 },
  chips: { gap: space.sm, flexDirection: 'row' },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
