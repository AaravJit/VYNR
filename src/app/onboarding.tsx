import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Brackets, Button, Notice, Screen, Txt } from '@/components/ui';
import { sanitizeUsername } from '@/services/gameService';
import { recognitionConfig, useAppState, useAppStore, useHaptics } from '@/state/AppProvider';
import { colors, radius, space } from '@/theme/tokens';

const SAFETY_RULES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'alert', title: 'Never scan while driving', body: 'Only use VYNR as a pedestrian or a parked passenger.' },
  { icon: 'shield', title: 'Stay on public ground', body: 'Do not enter private property, closed lots or restricted areas for a photo.' },
  { icon: 'lock', title: 'Hands off', body: 'Never touch, lean on or approach a vehicle closely. Respect owners and staff.' },
  { icon: 'scan', title: 'Vehicles, not people', body: 'Frame the car, not its occupants. Faces and plates are blurred on your phone.' },
];

const STEPS = 5;

export default function Onboarding() {
  const store = useAppStore();
  const state = useAppState();
  const haptics = useHaptics();
  const [step, setStep] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consent, setConsent] = useState(recognitionConfig.mode !== 'unconfigured');
  const [name, setName] = useState(state.player?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const validName = sanitizeUsername(name) !== null;

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

  const finish = async () => {
    setSaving(true);
    const ok = await store.completeOnboarding(name, consent);
    setSaving(false);
    if (ok) {
      haptics.success();
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ paddingBottom: space.xl, flexGrow: 1 }}>
        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.pip, i <= step && { backgroundColor: colors.accent }]} />
          ))}
        </View>

        {step === 0 && (
          <View style={styles.body}>
            <View style={styles.hero}>
              <Brackets color={colors.accent} size={22} />
              <Txt variant="label" color={colors.accent}>
                AUTOMOTIVE INTELLIGENCE
              </Txt>
              <Txt variant="display" style={{ fontSize: 56, lineHeight: 58, letterSpacing: -2 }}>
                VYNR
              </Txt>
              <Txt variant="body" color={colors.textMuted}>
                Spot real cars in the wild. Identify them, build your garage, and complete contracts to level up.
              </Txt>
            </View>
            <View style={{ flex: 1 }} />
            <Button label="Begin" icon="chevron-right" onPress={next} />
          </View>
        )}

        {step === 1 && (
          <View style={styles.body}>
            <Txt variant="label" upper>
              Field rules
            </Txt>
            <Txt variant="h1">Spot safely and respectfully</Txt>
            <View style={{ gap: space.sm }}>
              {SAFETY_RULES.map((r) => (
                <View key={r.title} style={styles.rule}>
                  <Icon name={r.icon} size={20} color={colors.accent} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodyStrong">{r.title}</Txt>
                    <Txt variant="small" color={colors.textMuted}>
                      {r.body}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              onPress={() => setAcknowledged((a) => !a)}
              style={styles.check}
            >
              <View style={[styles.box, acknowledged && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                {acknowledged && <Icon name="check" size={16} color={colors.accentInk} strokeWidth={2.5} />}
              </View>
              <Txt variant="body" style={{ flex: 1 }}>
                I understand and will follow these rules.
              </Txt>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Button label="Continue" disabled={!acknowledged} onPress={next} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.body}>
            <Txt variant="label" upper>
              Privacy
            </Txt>
            <Txt variant="h1">Your data stays yours</Txt>
            <View style={{ gap: space.sm }}>
              <Txt variant="body" color={colors.textMuted}>
                • Your garage, XP and history are stored only on this device.
              </Txt>
              <Txt variant="body" color={colors.textMuted}>
                • VYNR never collects your location and never reads number plates.
              </Txt>
              <Txt variant="body" color={colors.textMuted}>
                • Faces and number plates are pixelated on your phone before a photo is uploaded or kept. If that cannot run, the photo stays on the phone.
              </Txt>
              <Txt variant="body" color={colors.textMuted}>
                • Photos are downscaled and stripped of metadata. They are discarded after identification unless you
                choose to keep thumbnails.
              </Txt>
            </View>
            {recognitionConfig.mode === 'unconfigured' ? (
              <Notice
                title="Automatic identification is not available in this build"
                body="You can identify vehicles manually from the catalog after taking a photo."
              />
            ) : (
              <View style={styles.toggle}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="bodyStrong">Cloud identification</Txt>
                  <Txt variant="small" color={colors.textMuted}>
                    {recognitionConfig.mode === 'mock'
                      ? 'Development build: results are simulated on-device and nothing is uploaded.'
                      : 'Send each captured photo to the VYNR recognition service for identification. Photos are not stored by the service. Turn off to identify manually.'}
                  </Txt>
                </View>
                <Switch
                  accessibilityLabel="Allow cloud identification"
                  value={consent}
                  onValueChange={setConsent}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor={colors.text}
                />
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Button label="Continue" onPress={next} />
          </View>
        )}

        {step === 3 && (
          <View style={styles.body}>
            <Txt variant="label" upper>
              Callsign
            </Txt>
            <Txt variant="h1">What should we call you?</Txt>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. NightApex"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              accessibilityLabel="Username"
              style={styles.input}
              returnKeyType="done"
            />
            <Txt variant="small" color={validName || !name ? colors.textFaint : colors.danger}>
              3–20 characters: letters, numbers, spaces, dot, dash or underscore. Stored only on this device.
            </Txt>
            <View style={{ flex: 1 }} />
            <Button label="Continue" disabled={!validName} onPress={next} />
          </View>
        )}

        {step === 4 && (
          <View style={styles.body}>
            <Txt variant="label" upper>
              Camera
            </Txt>
            <Txt variant="h1">Enable the scanner</Txt>
            <Txt variant="body" color={colors.textMuted}>
              VYNR uses the camera only while the scanner is open, to photograph vehicles you choose to identify.
            </Txt>
            {permission?.granted ? (
              <Notice title="Camera access granted" body="You're ready to scan." />
            ) : permission && !permission.canAskAgain ? (
              <>
                <Notice
                  tone="warning"
                  title="Camera access is turned off"
                  body="Enable it in Settings to use the scanner. You can continue without it."
                />
                <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
              </>
            ) : (
              <Button label="Allow camera access" variant="secondary" icon="scan" onPress={() => void requestPermission()} />
            )}
            <View style={{ flex: 1 }} />
            <Button label="Enter VYNR" loading={saving} onPress={() => void finish()} />
          </View>
        )}

        {step > 0 && (
          <Button label="Back" variant="ghost" compact onPress={() => setStep((s) => Math.max(0, s - 1))} />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  body: { flex: 1, gap: space.lg, minHeight: 520 },
  hero: { marginTop: space.xxxl, padding: space.xl, gap: space.md },
  rule: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: 'InterTight_500Medium',
    fontSize: 18,
  },
});
