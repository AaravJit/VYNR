import { StyleSheet, View } from 'react-native';

import type { VehicleIntel } from '@/domain/intel';
import { colors, radius, space } from '@/theme/tokens';

import { Panel, Txt } from './ui';

function Meter({ level }: { level: 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no">
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.pip, i <= level && { backgroundColor: i >= 3 ? colors.accent : colors.violet }]} />
      ))}
    </View>
  );
}

function Grade({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.grade} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt variant="label" color={colors.textFaint} upper>
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

/**
 * The fictional intelligence layer. Always labelled as simulated: none of it
 * describes the real vehicle, its owner or its security.
 */
export function IntelPanel({ intel }: { intel: VehicleIntel }) {
  return (
    <Panel style={{ gap: space.md }} accessibilityLabel="Simulated vehicle intel, for entertainment only">
      <View style={styles.head}>
        <Txt variant="label" color={colors.violet}>
          STREET INTEL
        </Txt>
        <View style={styles.simTag}>
          <Txt variant="label" color={colors.textMuted} style={{ fontSize: 10 }}>
            SIMULATED · FOR FUN
          </Txt>
        </View>
      </View>

      <View style={styles.grid}>
        <Grade label="Reputation" value={intel.reputation} />
        <Grade label="Collector demand" value={intel.collectorDemand} />
        <Grade label="Tracker (sim)" value={intel.tracker} />
        <Grade label="Alarm (sim)" value={intel.alarm} />
      </View>

      <View style={{ gap: space.sm }}>
        {intel.traits.map((t) => (
          <View key={t.id} style={styles.trait} accessible accessibilityLabel={`${t.label}: ${t.value}`}>
            <View style={{ flex: 1 }}>
              <Txt variant="small" color={colors.textMuted}>
                {t.label}
              </Txt>
              <Txt variant="bodyStrong">{t.value}</Txt>
            </View>
            <Meter level={t.level} />
          </View>
        ))}
      </View>

      <View style={styles.quotes}>
        {intel.observations.map((o) => (
          <Txt key={o} variant="small" color={colors.text}>
            “{o}”
          </Txt>
        ))}
      </View>

      <Txt variant="small" color={colors.textFaint}>
        Made-up game flavour. VYNR never checks or reveals a real car’s security, tracker, alarm or keys.
      </Txt>
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  simTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  grade: { width: '50%', gap: 2, paddingRight: space.sm },
  trait: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meter: { flexDirection: 'row', gap: 3 },
  pip: { width: 14, height: 6, borderRadius: 3, backgroundColor: colors.border },
  quotes: { gap: 6, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: colors.violet },
});
