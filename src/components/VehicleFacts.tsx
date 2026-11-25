import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog, COUNTRY_NAMES, formatYears, RARITY_LABELS } from '@/catalog';
import { GAME_CONFIG } from '@/domain/config';
import type { CatalogVehicle } from '@/domain/types';
import { colors, rarityColors, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Divider, Panel, Txt } from './ui';

function Row({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}>
      <Txt variant="label" upper style={{ width: 118 }}>
        {label}
      </Txt>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={color}>
          {value}
        </Txt>
        {note ? (
          <Txt variant="small" color={colors.textFaint}>
            {note}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Facts from VYNR's curated catalog. Clearly separated from AI predictions so
 * the player can always tell verified data from model output.
 */
export function VehicleFacts({ vehicle }: { vehicle: CatalogVehicle }) {
  const m = catalog.getManufacturer(vehicle.manufacturerId);
  return (
    <Panel style={{ gap: space.md }}>
      <View style={styles.header}>
        <Icon name="shield" size={16} color={colors.accent} />
        <Txt variant="label" color={colors.accent}>
          VERIFIED CATALOG RECORD
        </Txt>
      </View>
      <Row label="Manufacturer" value={m?.name ?? vehicle.manufacturerId} />
      <Divider />
      <Row label="Model" value={vehicle.model} />
      <Divider />
      <Row label="Generation" value={vehicle.generation} />
      <Divider />
      <Row label="Production" value={formatYears(vehicle)} note="Estimated range. Trim and model year are not identified." />
      <Divider />
      <Row label="Origin" value={COUNTRY_NAMES[catalog.countryOf(vehicle)]} />
      <Divider />
      <Row label="Category" value={`${CATEGORY_LABELS[vehicle.category]}${vehicle.electric ? ' · Electric' : ''}`} />
      <Divider />
      <Row label="Rarity" value={RARITY_LABELS[vehicle.rarity]} color={rarityColors[vehicle.rarity].fg} />
      <Divider />
      <Row label="Base reward" value={`${GAME_CONFIG.rarityXp[vehicle.rarity].toLocaleString()} XP`} color={colors.accent} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
