import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { router, useIsFocused } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { catalog } from '@/catalog';
import { ApertureMark, BrandLockup } from '@/components/Brand';
import { DevModeBanner, VehicleEmblem } from '@/components/game';
import { Icon } from '@/components/Icon';
import { TargetBrackets } from '@/components/ScanOverlay';
import { Button, Panel, RarityBadge, Txt } from '@/components/ui';
import { confidenceBand } from '@/recognition/matcher';
import { HINT_TEXT } from '@/scanner/livePolicy';
import type { LiveScanView } from '@/scanner/liveScanner';
import { type LiveFind, useLiveScanner } from '@/scanner/useLiveScanner';
import { playSound } from '@/services/sound';
import { recognitionConfig, useAppState, useAppStore, useHaptics } from '@/state/AppProvider';
import { startScanSession } from '@/state/scanSession';
import { colors, layout, radius, space } from '@/theme/tokens';

const TAB_BAR_SPACE = layout.tabBarHeight;

/** Shown as a coarse band only: model confidence is self-reported and not calibrated. */
const BAND_COPY = { high: 'Strong match', medium: 'Possible match', low: 'Weak match' } as const;

const NOTICE_TEXT = {
  no_vehicle: 'No car recognised. Try another angle',
  unsure: 'Not sure yet. Try another angle',
  error: 'Connection problem. Trying again shortly',
} as const;

const BLOCKED: Record<string, { title: string; body: string; retry: boolean }> = {
  no_consent: {
    title: 'Cloud identification is off',
    body: 'Turn it on in Profile to identify cars automatically, or identify one yourself.',
    retry: false,
  },
  quota: {
    title: 'Today’s automatic identifications are used up',
    body: 'Your allowance resets tomorrow. You can still identify cars yourself.',
    retry: false,
  },
  no_redaction: {
    title: 'Privacy protection is unavailable',
    body: 'Faces and plates cannot be blurred on this device, so no photo is uploaded. You can identify cars yourself.',
    retry: false,
  },
  unconfigured: {
    title: 'Automatic identification is not set up',
    body: 'This build has no recognition service. You can identify cars yourself.',
    retry: false,
  },
  camera: { title: 'The camera stopped responding', body: 'Try again, or reopen the app.', retry: true },
  service: { title: 'The recognition service is not responding', body: 'Nothing more will be sent until you try again.', retry: true },
  not_ready: { title: 'VYNR is still starting', body: 'Try again in a moment.', retry: true },
};

function statusText(view: LiveScanView<LiveFind>, cameraReady: boolean): string {
  if (!cameraReady) return 'Starting camera…';
  if (view.status === 'identifying') return 'Identifying…';
  if (view.status === 'scanning' && view.notice && (view.hint === 'searching' || view.hint === 'already_checked')) {
    return NOTICE_TEXT[view.notice];
  }
  return HINT_TEXT[view.hint];
}

/**
 * The scanner is the home screen and scans automatically: point the phone at
 * a car and VYNR finds it, waits for a sharp, steady view, blurs faces and
 * plates on the phone and only then asks the cloud. Sampling runs only while
 * this tab is focused and the app is in the foreground, and the policy in
 * `src/scanner/livePolicy.ts` limits how often anything is uploaded.
 */
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const haptics = useHaptics();
  const state = useAppState();
  const store = useAppStore();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  // Leaving the scanner turns the torch off.
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (!focused) setTorch(false);
  }

  const active = focused && foreground && ready && !!permission?.granted && !mountError;
  const { view, rescan, dismiss } = useLiveScanner(camera, active, { store, playerId: state.player?.id ?? null });

  // Feedback when a result appears (once per result).
  const [announced, setAnnounced] = useState<LiveFind | null>(null);
  if (view.found !== announced) {
    setAnnounced(view.found);
  }
  useEffect(() => {
    if (!announced) return;
    haptics.success();
    playSound('identified', store.getState().settings.soundEnabled);
  }, [announced]); // eslint-disable-line react-hooks/exhaustive-deps

  const collect = (find: LiveFind, vehicleId?: string) => {
    const id = Crypto.randomUUID();
    startScanSession({
      id,
      image: find.image,
      previewUri: find.previewUri,
      redaction: find.redaction,
      result: find.result,
      manualVehicleId: vehicleId ?? null,
      createdAt: Date.now(),
    });
    dismiss();
    router.push({ pathname: '/identify', params: { scanId: id } });
  };

  /** Opens the identify screen without a prediction, for identifying a car by hand. */
  const identifyManually = () => {
    const id = Crypto.randomUUID();
    startScanSession({ id, image: null, previewUri: null, redaction: null, result: null, createdAt: Date.now() });
    dismiss();
    router.push({ pathname: '/identify', params: { scanId: id } });
  };

  const header = (
    <View style={styles.topBar}>
      <View style={styles.glassPill}>
        <BrandLockup size={20} />
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <DevModeBanner />
      </View>
      {permission?.granted ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel="Torch"
          onPress={() => {
            haptics.selection();
            setTorch((t) => !t);
          }}
          style={[styles.roundBtn, torch && { backgroundColor: colors.text }]}
        >
          <Icon name="flash" size={20} color={torch ? colors.bg : colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
        {header}
        <View style={[styles.permission, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}>
          <ApertureMark size={64} />
          <Txt variant="h2" align="center">
            Point at a car. VYNR does the rest.
          </Txt>
          <Txt variant="body" color={colors.textMuted} align="center">
            VYNR uses the camera only while the scanner is open. It checks each view on your phone first, blurs faces and
            plates, and sends a photo only when a car is in clear view.
          </Txt>
          {permission.canAskAgain ? (
            <Button label="Allow camera" icon="scan" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
          )}
          {recognitionConfig.mode === 'mock' && <Button label="Simulate a scan (dev)" variant="secondary" onPress={identifyManually} />}
        </View>
      </SafeAreaView>
    );
  }

  const tone = view.status === 'identifying' ? 'identifying' : view.hint === 'hold_steady' || view.hint === 'ready' ? 'locked' : 'tracking';
  const showPill = view.status === 'scanning' || view.status === 'identifying' || !ready;

  return (
    <View style={styles.root} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused && foreground}
        enableTorch={torch && focused && foreground}
        onCameraReady={() => setReady(true)}
        onMountError={(e) => setMountError(e.message)}
      />
      {(view.status === 'scanning' || view.status === 'identifying') && (
        <TargetBrackets box={view.target} aspect={view.frameAspect} size={size} tone={tone} />
      )}
      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']} pointerEvents="box-none">
        {header}
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View style={[styles.dock, { marginBottom: TAB_BAR_SPACE + insets.bottom }]}>
          {showPill && !mountError && (
            <View style={styles.hintRow} accessibilityLiveRegion="polite" accessible accessibilityLabel={statusText(view, ready)}>
              <View style={styles.hintPill}>
                {view.status === 'identifying' || !ready ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <View style={[styles.dot, { backgroundColor: tone === 'locked' ? colors.accent : colors.textMuted }]} />
                )}
                <Txt variant="bodyStrong" color={colors.text}>
                  {statusText(view, ready)}
                </Txt>
              </View>
            </View>
          )}

          {mountError && (
            <StateCard title="The camera could not start" body={mountError}>
              <Button label="Identify manually" variant="secondary" onPress={identifyManually} />
            </StateCard>
          )}

          {view.status === 'found' && view.found && <ResultCard find={view.found} onCollect={collect} onRescan={() => rescan()} />}

          {view.status === 'blocked' && view.blockedReason && (
            <StateCard
              title={BLOCKED[view.blockedReason]?.title ?? 'Scanning stopped'}
              body={BLOCKED[view.blockedReason]?.body ?? 'Try again in a moment.'}
            >
              {view.blockedReason === 'no_consent' && <Button label="Open Profile" onPress={() => router.push('/profile')} />}
              {BLOCKED[view.blockedReason]?.retry ? (
                <Button label="Try again" icon="refresh" onPress={() => rescan()} />
              ) : (
                <Button label="Identify manually" variant="secondary" onPress={identifyManually} />
              )}
            </StateCard>
          )}

          {view.status === 'paused' && view.pausedBy === 'idle' && (
            <StateCard title="Scanning paused" body="Nothing has been in view for a while, so VYNR paused to save battery.">
              <Button label="Resume scanning" icon="scan" onPress={() => rescan()} />
            </StateCard>
          )}

          {view.status === 'paused' && view.pausedBy === 'session_limit' && (
            <StateCard
              title="Session scan limit reached"
              body="VYNR stops after a dozen automatic identifications in one go. Each one also counts toward today’s allowance."
            >
              <Button label="Keep scanning" icon="scan" onPress={() => rescan(true)} />
            </StateCard>
          )}

          <View style={styles.footer}>
            <Txt variant="small" color={colors.textFaint} align="center" style={{ flex: 1 }}>
              Never scan while driving, and stay out of the road.
            </Txt>
            {recognitionConfig.mode === 'mock' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simulate a scan, development only"
                onPress={identifyManually}
                style={styles.simBtn}
              >
                <Txt variant="label" color={colors.warning}>
                  SIM
                </Txt>
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function StateCard({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <Panel style={styles.card}>
      <Txt variant="h3">{title}</Txt>
      <Txt variant="small" color={colors.textMuted}>
        {body}
      </Txt>
      <View style={{ gap: space.sm }}>{children}</View>
    </Panel>
  );
}

function ResultCard({
  find,
  onCollect,
  onRescan,
}: {
  find: LiveFind;
  onCollect: (find: LiveFind, vehicleId?: string) => void;
  onRescan: () => void;
}) {
  const top = find.matches[0];
  if (!top) return null;
  const vehicle = top.vehicle;
  const maker = catalog.getManufacturer(vehicle.manufacturerId)?.name ?? '';
  const sure = find.outcome === 'identified';
  const alternatives = find.matches.slice(1, 3);
  return (
    <Panel style={styles.card}>
      <View style={styles.resultHead}>
        <VehicleEmblem vehicle={vehicle} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" color={sure ? colors.accent : colors.warning}>
            {(sure ? BAND_COPY[confidenceBand(top.confidence)] : 'Not certain').toUpperCase()}
            {find.result.simulated ? ' · SIMULATED' : ''}
          </Txt>
          <Txt variant="h3" numberOfLines={1}>
            {maker} {vehicle.model}
          </Txt>
          <Txt variant="small" color={colors.textMuted}>
            {vehicle.generation} · {vehicle.yearStart}–{vehicle.yearEnd ?? 'present'}
          </Txt>
        </View>
        <RarityBadge rarity={vehicle.rarity} size="sm" />
      </View>
      {!sure && (
        <Txt variant="small" color={colors.textMuted}>
          Check it is right before collecting, or try another angle for a clearer answer.
        </Txt>
      )}
      {alternatives.length > 0 && (
        <View style={{ gap: space.xs }}>
          <Txt variant="label" color={colors.textFaint}>
            COULD ALSO BE
          </Txt>
          <View style={styles.altRow}>
            {alternatives.map((m) => (
              <Pressable
                key={m.vehicle.id}
                accessibilityRole="button"
                accessibilityLabel={`Collect as ${catalog.displayName(m.vehicle)}`}
                onPress={() => onCollect(find, m.vehicle.id)}
                style={styles.alt}
              >
                <Txt variant="small" color={colors.text} numberOfLines={1}>
                  {catalog.displayName(m.vehicle)}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <View style={styles.actions}>
        <Button label="Try another angle" variant="secondary" icon="refresh" compact onPress={onRescan} style={{ flex: 1 }} />
        <Button label={sure ? 'Collect' : 'Review'} icon={sure ? 'check' : 'chevron-right'} compact onPress={() => onCollect(find)} style={{ flex: 1 }} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
  glassPill: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: space.xl, gap: space.lg },
  dock: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  hintRow: { alignItems: 'center' },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { gap: space.md, backgroundColor: colors.glassStrong },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  altRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  alt: {
    paddingHorizontal: space.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    maxWidth: '100%',
  },
  actions: { flexDirection: 'row', gap: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  simBtn: {
    width: 56,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningLine,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
