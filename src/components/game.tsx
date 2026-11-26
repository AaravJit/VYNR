import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog, COUNTRY_NAMES } from '@/catalog';
import { describeContract } from '@/domain/contracts';
import type { LevelInfo } from '@/domain/progression';
import type { CatalogVehicle, Contract } from '@/domain/types';
import { recognitionConfig } from '@/state/AppProvider';
import { colors, radius, rarityColors, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Panel, ProgressBar, RarityBadge, Txt } from './ui';

/** Original monogram emblem used instead of vehicle photography (no licensed imagery required). */
export function VehicleEmblem({ vehicle, size = 56, locked }: { vehicle: CatalogVehicle; size?: number; locked?: boolean }) {
  const c = rarityColors[vehicle.rarity];
  const maker = catalog.getManufacturer(vehicle.manufacturerId)?.name ?? '';
  const initials = maker
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={[
        styles.emblem,
        {
          width: size,
          height: size,
          borderColor: locked ? colors.border : c.line,
          backgroundColor: locked ? colors.surfaceRaised : c.soft,
        },
      ]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      {locked ? (
        <Icon name="lock" size={size * 0.36} color={colors.textFaint} />
      ) : (
        <Txt variant="h3" color={c.fg} style={{ fontSize: size * 0.32, lineHeight: size * 0.38 }}>
          {initials}
        </Txt>
      )}
    </View>
  );
}

export function VehicleRow({
  vehicle,
  subtitle,
  onPress,
  locked,
  right,
}: {
  vehicle: CatalogVehicle;
  subtitle?: string;
  onPress?: () => void;
  locked?: boolean;
  right?: React.ReactNode;
}) {
  const name = catalog.displayName(vehicle);
  const country = COUNTRY_NAMES[catalog.countryOf(vehicle)];
  return (
    <Panel
      onPress={onPress}
      accessibilityLabel={locked ? `Undiscovered ${vehicle.rarity} vehicle` : `${name}, ${vehicle.generation}, ${vehicle.rarity}`}
      style={styles.row}
    >
      <VehicleEmblem vehicle={vehicle} locked={locked} size={48} />
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="h3" numberOfLines={1}>
          {locked ? 'Undiscovered' : name}
        </Txt>
        <Txt variant="small" color={colors.textMuted} numberOfLines={1}>
          {locked
            ? `${CATEGORY_LABELS[vehicle.category]} · ${country}`
            : (subtitle ?? `${vehicle.generation} · ${CATEGORY_LABELS[vehicle.category]} · ${country}`)}
        </Txt>
        <RarityBadge rarity={vehicle.rarity} size="sm" />
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.textFaint} /> : null)}
    </Panel>
  );
}

export function LevelPanel({ level, username }: { level: LevelInfo; username: string }) {
  return (
    <Panel bracket={colors.accentLine} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 2 }}>
          <Txt variant="label" upper>
            Spotter
          </Txt>
          <Txt variant="h2" numberOfLines={1}>
            {username}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="label" upper>
            Level
          </Txt>
          <Txt variant="display" color={colors.accent} accessibilityLabel={`Level ${level.level}`}>
            {level.level}
          </Txt>
        </View>
      </View>
      <ProgressBar value={level.progress} label="Progress to next level" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="mono" color={colors.textMuted}>
          {level.totalXp.toLocaleString()} XP
        </Txt>
        <Txt variant="mono" color={colors.textMuted}>
          {level.isMax ? 'MAX LEVEL' : `${(level.xpForNext - level.xpIntoLevel).toLocaleString()} XP to L${level.level + 1}`}
        </Txt>
      </View>
    </Panel>
  );
}

export function ContractCard({ contract }: { contract: Contract }) {
  const done = contract.completedAt !== null;
  const title = describeContract(contract, catalog);
  return (
    <Panel
      style={[styles.contract, done && { borderColor: colors.accentLine }]}
      accessibilityLabel={`${title}. ${done ? 'Completed' : `${contract.progress} of ${contract.target}`}. Reward ${contract.rewardXp} XP`}
    >
      <View style={[styles.contractIcon, done && { backgroundColor: colors.accent }]}>
        <Icon name={done ? 'check' : 'contracts'} size={18} color={done ? colors.accentInk : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="bodyStrong" color={done ? colors.textMuted : colors.text}>
          {title}
        </Txt>
        <ProgressBar value={contract.progress / contract.target} color={done ? colors.accent : colors.accent} height={4} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="mono" color={colors.textMuted}>
            {done ? 'COMPLETE' : `${contract.progress}/${contract.target}`}
          </Txt>
          <Txt variant="mono" color={colors.accent}>
            +{contract.rewardXp} XP
          </Txt>
        </View>
      </View>
    </Panel>
  );
}

/** Persistent, unmissable label whenever results are simulated. */
export function DevModeBanner() {
  if (recognitionConfig.mode !== 'mock') return null;
  return (
    <View style={styles.devBanner} accessibilityRole="text" accessibilityLabel="Development mode: recognition results are simulated">
      <Icon name="alert" size={14} color={colors.warning} />
      <Txt variant="label" color={colors.warning}>
        DEV MODE · SIMULATED RECOGNITION
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  contract: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  contractIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warningLine,
    backgroundColor: colors.warningSoft,
  },
});
