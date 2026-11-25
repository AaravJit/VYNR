import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS, catalog, COUNTRY_NAMES } from '@/catalog';
import { describeContract } from '@/domain/contracts';
import type { LevelInfo } from '@/domain/progression';
import type { CatalogVehicle, Contract } from '@/domain/types';
import { recognitionConfig } from '@/state/AppProvider';
import { colors, radius, rarityColors, space } from '@/theme/tokens';

import { GradientFill, Ring } from './Gradient';
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
      {!locked && <GradientFill colors={[c.soft, 'rgba(11,7,22,0)']} direction="diagonal" />}
      {!locked && <View style={[styles.emblemShine, { backgroundColor: c.fg }]} />}
      {locked ? (
        <Icon name="lock" size={size * 0.36} color={colors.textFaint} />
      ) : (
        <Txt
          variant="h2"
          color={c.fg}
          style={{ fontSize: size * 0.3, lineHeight: size * 0.38, fontFamily: 'Unbounded_800ExtraBold' }}
        >
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
  const ring = 104;
  return (
    <Panel highlight style={styles.level}>
      <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
        <Ring size={ring} stroke={9} progress={level.progress} trackColor={colors.surfacePressed} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.levelCenter}>
            <Txt variant="label" upper color={colors.textMuted}>
              Lvl
            </Txt>
            <Txt variant="display" accessibilityLabel={`Level ${level.level}`} style={{ fontSize: 28, lineHeight: 32 }}>
              {String(level.level).padStart(2, '0')}
            </Txt>
          </View>
        </View>
      </View>
      <View style={{ flex: 1, gap: space.sm }}>
        <View style={{ gap: 2 }}>
          <Txt variant="label" upper color={colors.accent}>
            Spotter
          </Txt>
          <Txt variant="h2" numberOfLines={1}>
            {username}
          </Txt>
        </View>
        <ProgressBar value={level.progress} label="Progress to next level" height={6} />
        <Txt variant="mono" color={colors.textMuted}>
          {level.totalXp.toLocaleString()} XP
        </Txt>
        <Txt variant="small" color={colors.textFaint}>
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
      highlight={done}
      style={styles.contract}
      accessibilityLabel={`${title}. ${done ? 'Completed' : `${contract.progress} of ${contract.target}`}. Reward ${contract.rewardXp} XP`}
    >
      <View style={styles.contractIcon}>
        <GradientFill opacity={done ? 1 : 0.2} />
        <Icon name={done ? 'check' : 'contracts'} size={18} color={done ? colors.accentInk : colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="bodyStrong" color={done ? colors.textMuted : colors.text}>
          {title}
        </Txt>
        <ProgressBar value={contract.progress / contract.target} height={6} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="mono" color={colors.textMuted}>
            {done ? 'COMPLETE' : `${contract.progress}/${contract.target}`}
          </Txt>
          <Txt variant="mono" color={colors.violet}>
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
  emblem: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emblemShine: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderRadius: 1, opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  level: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  levelCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contract: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  contractIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accentLine,
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
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningLine,
    backgroundColor: colors.warningSoft,
  },
});
