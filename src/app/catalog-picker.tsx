import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { catalog } from '@/catalog';
import { VehicleRow } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button, Panel, Txt } from '@/components/ui';
import { getScanSession, updateScanSession } from '@/state/scanSession';
import { colors, radius, space } from '@/theme/tokens';

/** Manual identification / correction: search the curated catalog. */
export default function CatalogPicker() {
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => catalog.search(query).sort((a, b) => catalog.displayName(a).localeCompare(catalog.displayName(b))),
    [query],
  );
  const session = getScanSession(scanId);

  const choose = (vehicleId: string) => {
    if (session) updateScanSession(session.id, { manualVehicleId: vehicleId, unknownLabel: null });
    router.back();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Txt variant="h2">Choose vehicle</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <Icon name="close" size={20} />
        </Pressable>
      </View>
      {!session ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Txt variant="body" color={colors.textMuted}>
            This scan has expired. Scan the car again to log an encounter.
          </Txt>
          <Button label="Close" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search make, model or generation"
              placeholderTextColor={colors.textFaint}
              autoFocus
              autoCorrect={false}
              accessibilityLabel="Search catalog"
              style={styles.input}
            />
          </View>
          <FlatList
            data={results}
            keyExtractor={(v) => v.id}
            contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xxxl }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <VehicleRow vehicle={item} onPress={() => choose(item.id)} />}
            ListEmptyComponent={
              <Panel style={{ gap: space.sm }}>
                <Txt variant="bodyStrong">No catalog match for “{query}”</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  The catalog is curated and growing. Log this sighting as a field note instead: it earns a small XP
                  reward but does not count toward collection completion.
                </Txt>
                <Button
                  label="Log as field note"
                  variant="secondary"
                  compact
                  disabled={query.trim().length < 2}
                  onPress={() => {
                    updateScanSession(session.id, { unknownLabel: query.trim().slice(0, 60), manualVehicleId: null });
                    router.back();
                  }}
                />
              </Panel>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  input: { flex: 1, color: colors.text, fontFamily: 'InterTight_500Medium', fontSize: 16 },
});
