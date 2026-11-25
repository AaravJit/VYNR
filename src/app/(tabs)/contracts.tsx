import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ContractCard } from '@/components/game';
import { EmptyState, Panel, Screen, SectionHeader, Txt } from '@/components/ui';
import { periodEnd } from '@/domain/time';
import { useAppState, useAppStore } from '@/state/AppProvider';
import { colors, space } from '@/theme/tokens';

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function Contracts() {
  const state = useAppState();
  const store = useAppStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Roll over to new contracts when a period ends while the screen is open.
  const dailyEnds = periodEnd('daily', now);
  useEffect(() => {
    void store.reload();
  }, [dailyEnds, store]);

  const { daily, weekly } = useMemo(() => store.currentContracts(), [store, state.revision, dailyEnds]); // eslint-disable-line react-hooks/exhaustive-deps
  const completedTotal = state.contracts.filter((c) => c.completedAt !== null).length;
  const doneToday = daily.filter((c) => c.completedAt !== null).length;

  return (
    <Screen>
      <Txt variant="h1">Contracts</Txt>
      <Panel style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Txt variant="label" upper>
            Today
          </Txt>
          <Txt variant="h2">
            {doneToday}/{daily.length} complete
          </Txt>
        </View>
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <Txt variant="label" upper>
            All time
          </Txt>
          <Txt variant="h2" color={colors.accent}>
            {completedTotal}
          </Txt>
        </View>
      </Panel>

      <SectionHeader
        title="Daily"
        action={
          <Txt variant="mono" color={colors.textMuted}>
            Resets in {countdown(dailyEnds - now)}
          </Txt>
        }
      />
      {daily.length === 0 ? (
        <EmptyState icon="contracts" title="Generating contracts" body="New contracts appear at the start of each day." />
      ) : (
        <View style={{ gap: space.sm }}>
          {daily.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </View>
      )}

      <SectionHeader
        title="Weekly"
        action={
          <Txt variant="mono" color={colors.textMuted}>
            Resets in {countdown(periodEnd('weekly', now) - now)}
          </Txt>
        }
      />
      <View style={{ gap: space.sm }}>
        {weekly.map((c) => (
          <ContractCard key={c.id} contract={c} />
        ))}
      </View>
      <Txt variant="small" color={colors.textFaint}>
        Rewards are granted automatically when a contract completes. Re-logging the same vehicle within 10 minutes does not
        count.
      </Txt>
    </Screen>
  );
}
