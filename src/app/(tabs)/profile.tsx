import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { LevelPanel } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button, Divider, Panel, ProgressBar, Screen, SectionHeader, StatTile, Txt } from '@/components/ui';
import type { Settings } from '@/db/repository';
import { sanitizeUsername } from '@/services/gameService';
import { shareExport } from '@/services/exportService';
import { recognitionConfig, useAppState, useAppStore, useHaptics } from '@/state/AppProvider';
import { colors, radius, space } from '@/theme/tokens';

const MODE_LABEL = {
  remote: 'Cloud recognition service',
  mock: 'Simulated (development mode)',
  unconfigured: 'Not configured: manual identification only',
} as const;

function SettingRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.setting}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="small" color={colors.textMuted}>
          {description}
        </Txt>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
      />
    </View>
  );
}

export default function Profile() {
  const state = useAppState();
  const store = useAppStore();
  const haptics = useHaptics();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.player?.username ?? '');
  const [busy, setBusy] = useState<null | 'export' | 'delete'>(null);
  const s = state.stats;
  const unlocked = state.achievements.filter((a) => a.unlockedAt !== null).length;

  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => void store.setSetting(k, v);

  const saveName = async () => {
    if (await store.setUsername(name)) {
      haptics.success();
      setEditing(false);
    }
  };

  const doExport = async () => {
    setBusy('export');
    try {
      const result = await shareExport(await store.exportData());
      if (result === 'unavailable') Alert.alert('Export unavailable', 'Sharing is not available on this device.');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete all data?',
      'This permanently erases your garage, XP, contracts, achievements, saved photos and settings from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await store.deleteAllData();
              haptics.warning();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Txt variant="h1">Profile</Txt>
      <LevelPanel level={state.level} username={state.player?.username ?? ''} />

      {editing ? (
        <Panel style={{ gap: space.sm }}>
          <Txt variant="label" upper>
            Username
          </Txt>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Username"
            style={styles.input}
          />
          {!sanitizeUsername(name) && (
            <Txt variant="small" color={colors.danger}>
              3–20 characters: letters, numbers, spaces, dot, dash or underscore.
            </Txt>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Cancel" variant="ghost" compact style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button label="Save" compact style={{ flex: 1 }} disabled={!sanitizeUsername(name)} onPress={() => void saveName()} />
          </View>
        </Panel>
      ) : (
        <Button
          label="Edit username"
          variant="secondary"
          icon="edit"
          compact
          onPress={() => {
            setName(state.player?.username ?? '');
            setEditing(true);
          }}
        />
      )}

      <SectionHeader title="Discovery statistics" />
      <View style={styles.grid}>
        <StatTile label="Total XP" value={state.totalXp.toLocaleString()} accent={colors.accent} />
        <StatTile label="Unique" value={`${s.uniqueVehicles}`} sub={`of ${s.catalogSize} catalogued`} />
        <StatTile label="Encounters" value={`${s.totalEncounters}`} sub={s.unknownLogged ? `${s.unknownLogged} field notes` : undefined} />
        <StatTile label="Manufacturers" value={`${s.manufacturersSeen}`} sub={`${s.completedManufacturers.length} completed`} />
        <StatTile label="Countries" value={`${s.countriesSeen.length}/6`} />
        <StatTile label="Streak" value={`${s.currentStreak}d`} sub={`Best ${s.longestStreak}d`} />
      </View>

      <SectionHeader
        title="Achievements"
        action={
          <Txt variant="mono" color={colors.textMuted}>
            {unlocked}/{state.achievements.length}
          </Txt>
        }
      />
      <View style={{ gap: space.sm }}>
        {state.achievements.map((a) => {
          const done = a.unlockedAt !== null;
          return (
            <Panel
              key={a.key}
              style={[styles.ach, done && { borderColor: colors.accentLine }]}
              accessibilityLabel={`${a.title}. ${a.description}. ${done ? 'Unlocked' : `${a.progress} of ${a.target}`}`}
            >
              <View style={[styles.achIcon, done && { backgroundColor: colors.accent }]}>
                <Icon name={done ? 'bolt' : 'lock'} size={18} color={done ? colors.accentInk : colors.textFaint} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt variant="bodyStrong" color={done ? colors.text : colors.textMuted}>
                    {a.title}
                  </Txt>
                  <Txt variant="mono" color={done ? colors.accent : colors.textFaint}>
                    +{a.xp}
                  </Txt>
                </View>
                <Txt variant="small" color={colors.textMuted}>
                  {a.description}
                </Txt>
                {!done && <ProgressBar value={a.progress / a.target} height={3} color={colors.textMuted} />}
              </View>
            </Panel>
          );
        })}
      </View>

      <SectionHeader title="Settings" />
      <Panel style={{ gap: space.md }}>
        <SettingRow label="Haptics" description="Subtle vibration feedback." value={state.settings.hapticsEnabled} onChange={set('hapticsEnabled')} />
        <Divider />
        <SettingRow
          label="Keep photo thumbnails"
          description="Save a small, metadata-free thumbnail of confirmed encounters on this device. Off by default."
          value={state.settings.keepPhotos}
          onChange={set('keepPhotos')}
        />
        <Divider />
        <SettingRow
          label="Cloud identification"
          description={
            recognitionConfig.mode === 'remote'
              ? 'Send captured photos to the VYNR recognition service. When off, you identify vehicles manually and photos never leave the device.'
              : `Recognition mode: ${MODE_LABEL[recognitionConfig.mode]}.`
          }
          value={state.settings.cloudRecognitionConsent}
          disabled={recognitionConfig.mode !== 'remote'}
          onChange={set('cloudRecognitionConsent')}
        />
      </Panel>

      <SectionHeader title="Privacy & data" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Privacy and safety details"
        onPress={() => router.push('/privacy')}
        style={({ pressed }) => [styles.link, pressed && { backgroundColor: colors.surfacePressed }]}
      >
        <Icon name="shield" size={20} color={colors.accent} />
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          Privacy & safety details
        </Txt>
        <Icon name="chevron-right" size={18} color={colors.textFaint} />
      </Pressable>
      <Button label="Export my data (JSON)" variant="secondary" icon="download" loading={busy === 'export'} onPress={() => void doExport()} />
      <Button label="Delete all data" variant="danger" icon="trash" loading={busy === 'delete'} onPress={confirmDelete} />
      <Txt variant="small" color={colors.textFaint} align="center">
        All progress is stored locally on this device.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ach: { flexDirection: 'row', gap: space.md, padding: space.md, alignItems: 'flex-start' },
  achIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: space.md,
    fontFamily: 'InterTight_500Medium',
    fontSize: 16,
  },
});
