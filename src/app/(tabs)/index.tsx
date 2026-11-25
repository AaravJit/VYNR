import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApertureMark, BrandLockup, GradientRing } from '@/components/Brand';
import { DevModeBanner } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Viewfinder } from '@/components/ScanOverlay';
import { Button, Notice, Txt } from '@/components/ui';
import { prepareForRecognition } from '@/services/imageService';
import { playSound } from '@/services/sound';
import { recognitionConfig, useAppState, useHaptics } from '@/state/AppProvider';
import { startScanSession } from '@/state/scanSession';
import { colors, layout, radius, space } from '@/theme/tokens';

const TAB_BAR_SPACE = layout.tabBarHeight;

type Phase = 'idle' | 'capturing' | 'processing' | 'error';

/**
 * The scanner is the home screen. The camera runs only while this tab is
 * focused and the app is in the foreground; nothing is sent anywhere until the
 * player presses the shutter, and recognition is never continuous.
 */
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  // Synchronous guard so a double tap cannot start two captures.
  const captureLock = useRef(false);
  const haptics = useHaptics();
  const state = useAppState();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  // Coming back to the scanner always resets it for the next shot; leaving it turns the torch off.
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) setPhase('idle');
    else setTorch(false);
  }
  useEffect(() => {
    if (focused) captureLock.current = false;
  }, [focused]);

  const active = focused && foreground;

  const capture = async () => {
    if (!camera.current || captureLock.current) return;
    captureLock.current = true;
    setPhase('capturing');
    setError(null);
    haptics.impact();
    playSound('shutter', state.settings.soundEnabled);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9, exif: false, base64: false, shutterSound: false });
      if (!photo) throw new Error('The camera did not return a photo.');
      setPhase('processing');
      const prepared = await prepareForRecognition(photo.uri, photo.width, photo.height);
      const id = Crypto.randomUUID();
      startScanSession({
        id,
        image: { base64: prepared.base64, width: prepared.width, height: prepared.height },
        previewUri: prepared.previewUri,
        redaction: prepared.redaction,
        result: null,
        createdAt: Date.now(),
      });
      router.push({ pathname: '/identify', params: { scanId: id } });
    } catch (e) {
      haptics.error();
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Capture failed.');
      captureLock.current = false;
    }
  };

  /** Development-only path for simulators without a camera. Clearly labelled and absent in release builds. */
  const simulate = () => {
    const id = Crypto.randomUUID();
    startScanSession({ id, image: null, previewUri: null, redaction: null, result: null, createdAt: Date.now() });
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
            Point. Shoot. Collect.
          </Txt>
          <Txt variant="body" color={colors.textMuted} align="center">
            VYNR needs the camera to photograph cars you spot. It only runs while the scanner is open, and nothing is
            sent until you press the shutter.
          </Txt>
          {permission.canAskAgain ? (
            <Button label="Allow camera" icon="scan" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
          )}
          {recognitionConfig.mode === 'mock' && <Button label="Simulate capture (dev)" variant="secondary" onPress={simulate} />}
        </View>
      </SafeAreaView>
    );
  }

  const busy = phase === 'capturing' || phase === 'processing';
  return (
    <View style={styles.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={active}
        enableTorch={torch && active}
        animateShutter
        onCameraReady={() => setReady(true)}
        onMountError={(e) => {
          setPhase('error');
          setError(e.message);
        }}
      />
      <Viewfinder
        state={busy ? 'busy' : ready ? 'ready' : 'starting'}
        hint={phase === 'processing' ? 'Securing photo…' : ready ? 'Fit the whole car in the frame' : 'Starting camera…'}
      />
      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']} pointerEvents="box-none">
        {header}
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View style={[styles.dock, { marginBottom: TAB_BAR_SPACE + insets.bottom }]}>
          {error && <Notice tone="danger" title="Capture failed" body={error} />}
          <View style={styles.shutterRow}>
            <View style={styles.sideSlot}>
              <Txt variant="label" color={colors.textMuted} align="center">
                {state.stats.uniqueVehicles}/{state.stats.catalogSize}
              </Txt>
              <Txt variant="label" color={colors.textFaint} align="center" style={{ fontSize: 9 }}>
                COLLECTED
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
              accessibilityHint="Photographs the vehicle and identifies it"
              accessibilityState={{ disabled: !ready || busy, busy }}
              disabled={!ready || busy}
              onPress={() => void capture()}
              style={({ pressed }) => [styles.shutter, (pressed || busy) && { transform: [{ scale: 0.94 }] }]}
            >
              <GradientRing size={84} stroke={4} />
              {busy ? <ActivityIndicator color={colors.text} /> : <View style={styles.shutterInner} />}
            </Pressable>
            <View style={styles.sideSlot}>
              {recognitionConfig.mode === 'mock' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Simulate capture, development only" onPress={simulate} style={styles.simBtn}>
                  <Txt variant="label" color={colors.warning}>
                    SIM
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Txt variant="small" color={colors.textFaint} align="center">
            Never scan while driving. Faces and plates are blurred on your phone.
          </Txt>
        </View>
      </SafeAreaView>
    </View>
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
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  sideSlot: { width: 72, alignItems: 'center', gap: 2 },
  shutter: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.text },
  simBtn: {
    width: 64,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningLine,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
