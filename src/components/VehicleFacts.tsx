import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog, COUNTRY_NAMES, formatYears, RARITY_LABELS } from '@/catalog';
import { formatPower, getSpecs, type VehicleSpecs } from '@/catalog/specs';
import { GAME_CONFIG } from '@/domain/config';
import type { CatalogVehicle } from '@/domain/types';
import { colors, rarityColors, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Divider, Panel, Txt } from './ui';

function Row({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}>
      <Txt variant="small" color={colors.textMuted} style={{ width: 112 }}>
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

const cc = (n: number) => `${(n / 1000).toFixed(1)} L`;

function engineLine(e: VehicleSpecs['engines'][number]): string {
  const parts = [
    e.configuration,
    e.displacementCc ? cc(e.displacementCc) : null,
    e.aspiration && e.aspiration !== 'NA' && e.aspiration !== 'electric' ? e.aspiration : null,
    formatPower(e),
    e.torqueNm != null ? `${e.torqueNm} Nm` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : e.name;
}

function SpecSection({ specs }: { specs: VehicleSpecs }) {
  return (
    <>
      {specs.chassis ? (
        <>
          <Divider />
          <Row label="Chassis" value={specs.chassis} />
        </>
      ) : null}
      {specs.bodyStyles.length ? (
        <>
          <Divider />
          <Row label="Body styles" value={specs.bodyStyles.map((b) => b[0]!.toUpperCase() + b.slice(1)).join(', ')} />
        </>
      ) : null}
      {specs.layout ? (
        <>
          <Divider />
          <Row label="Layout" value={specs.layout} />
        </>
      ) : null}
      {specs.drivetrains.length ? (
        <>
          <Divider />
          <Row label="Drivetrain" value={specs.drivetrains.join(' / ')} />
        </>
      ) : null}
      {specs.engines.length ? (
        <>
          <Divider />
          <View style={{ gap: 6 }}>
            <Txt variant="small" color={colors.textMuted}>
              {specs.engines.length > 1 ? `Engines offered (${specs.engines.length})` : 'Engine'}
            </Txt>
            {specs.engines.map((e, i) => (
              <View key={`${e.name}-${i}`} accessible accessibilityLabel={`${e.name}: ${engineLine(e)}`}>
                <Txt variant="bodyStrong">{e.name}</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  {engineLine(e)}
                  {e.note ? ` · ${e.note}` : ''}
                </Txt>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {specs.transmissions.length ? (
        <>
          <Divider />
          <Row label="Transmissions" value={specs.transmissions.join(', ')} />
        </>
      ) : null}
      {specs.performance.length ? (
        <>
          <Divider />
          <View style={{ gap: 6 }}>
            <Txt variant="small" color={colors.textMuted}>
              Factory performance
            </Txt>
            {specs.performance.map((p, i) => (
              <Txt key={i} variant="small" color={colors.text}>
                {p.metric}: <Txt variant="bodyStrong">{p.value}</Txt>
                {p.variant ? <Txt variant="small" color={colors.textFaint}>{` (${p.variant})`}</Txt> : null}
              </Txt>
            ))}
          </View>
        </>
      ) : null}
      <Divider />
      <View style={{ gap: 4 }}>
        <Txt variant="small" color={colors.textFaint}>
          Options offered for this generation. VYNR cannot tell which one this car has.
        </Txt>
        {specs.sources.map((s) => (
          <Pressable key={s.url} accessibilityRole="link" accessibilityLabel={`Source: ${s.title}`} onPress={() => void Linking.openURL(s.url)}>
            <Txt variant="small" color={colors.blue} numberOfLines={1}>
              Source: {s.title}
            </Txt>
          </Pressable>
        ))}
      </View>
    </>
  );
}

/**
 * Facts from VYNR's curated catalog. Visually separate from AI predictions so
 * the player can always tell verified data from model output.
 */
export function VehicleFacts({ vehicle }: { vehicle: CatalogVehicle }) {
  const m = catalog.getManufacturer(vehicle.manufacturerId);
  const specs = getSpecs(vehicle.id);
  return (
    <Panel style={{ gap: space.md }}>
      <View style={styles.header}>
        <Icon name="shield" size={16} color={colors.blue} />
        <Txt variant="label" color={colors.blue}>
          VERIFIED CATALOG RECORD
        </Txt>
      </View>
      <Row label="Manufacturer" value={m?.name ?? vehicle.manufacturerId} />
      <Divider />
      <Row label="Model" value={vehicle.model} />
      <Divider />
      <Row label="Generation" value={vehicle.generation} />
      <Divider />
      <Row label="Production" value={formatYears(vehicle)} note="Approximate range. Trim and model year are not identified." />
      <Divider />
      <Row label="Origin" value={COUNTRY_NAMES[catalog.countryOf(vehicle)]} />
      <Divider />
      <Row label="Category" value={`${CATEGORY_LABELS[vehicle.category]}${vehicle.electric ? ' · Electric' : ''}`} />
      <Divider />
      <Row label="Rarity" value={RARITY_LABELS[vehicle.rarity]} color={rarityColors[vehicle.rarity].fg} />
      <Divider />
      <Row label="Base reward" value={`${GAME_CONFIG.rarityXp[vehicle.rarity].toLocaleString()} XP`} color={colors.accent} />
      {specs ? (
        <SpecSection specs={specs} />
      ) : (
        <>
          <Divider />
          <Txt variant="small" color={colors.textFaint}>
            Technical specifications for this generation have not been verified yet, so none are shown.
          </Txt>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
