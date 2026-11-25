import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Panel, Screen, Txt } from '@/components/ui';
import { recognitionConfig } from '@/state/AppProvider';
import { colors, space } from '@/theme/tokens';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What stays on your device',
    body: [
      'Your username, garage, encounter history, XP, contracts, achievements and settings are stored in a local database on this device only.',
      'There is no account and no analytics or advertising SDK.',
    ],
  },
  {
    title: 'Photos',
    body: [
      'The full-resolution capture is deleted immediately after it is downscaled to at most 1024 px and re-encoded as JPEG.',
      'All metadata (EXIF, GPS, device information) is stripped before the image is used.',
      'The image is held in memory for identification and discarded afterwards, unless you turn on “Keep photo thumbnails”, which saves a 640 px metadata-free thumbnail on this device only.',
    ],
  },
  {
    title: 'Cloud identification',
    body: [
      'Only when you allow it, the processed image is sent over HTTPS to the VYNR recognition service, which forwards it to an AI vision provider and returns make, model and generation predictions.',
      'The service does not store images and does not log request bodies. An anonymous, one-way hashed install identifier is sent so the service can enforce rate limits.',
      'You can turn cloud identification off at any time in Profile → Settings and identify vehicles manually instead.',
    ],
  },
  {
    title: 'What VYNR never does',
    body: [
      'VYNR never requests or records your location.',
      'VYNR never reads, stores or transmits number plates, and the recognition service is instructed to ignore plates and people.',
      'VYNR never connects to, unlocks or communicates with any vehicle, key or vehicle electronics.',
    ],
  },
  {
    title: 'Your controls',
    body: [
      'Export: Profile → Export my data produces a JSON file of everything VYNR stores about you.',
      'Delete: Profile → Delete all data permanently erases the local database and any saved thumbnails.',
    ],
  },
  {
    title: 'Safety',
    body: [
      'Never use VYNR while driving or cycling.',
      'Stay on public ground. Do not trespass, enter closed lots or approach restricted vehicles.',
      'Do not touch vehicles or photograph people. Respect owners and their privacy.',
    ],
  },
];

export default function Privacy() {
  return (
    <Screen
      edges={['top', 'bottom']}
      header={
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
            <Icon name="chevron-left" size={22} />
          </Pressable>
        </View>
      }
    >
      <Txt variant="h1">Privacy & safety</Txt>
      <Txt variant="small" color={colors.textMuted}>
        Recognition mode in this build:{' '}
        {recognitionConfig.mode === 'remote'
          ? 'cloud service'
          : recognitionConfig.mode === 'mock'
            ? 'simulated, on-device (development)'
            : 'not configured (manual only)'}
      </Txt>
      {SECTIONS.map((s) => (
        <Panel key={s.title} style={{ gap: space.sm }}>
          <Txt variant="h3" accessibilityRole="header">
            {s.title}
          </Txt>
          {s.body.map((b) => (
            <Txt key={b} variant="small" color={colors.textMuted}>
              {b}
            </Txt>
          ))}
        </Panel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
