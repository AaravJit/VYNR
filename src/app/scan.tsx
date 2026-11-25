import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DevModeBanner } from '@/components/game';
import { GradientFill } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import { ScanOverlay } from '@/components/ScanOverlay';
import { Button, Notice, Txt } from '@/components/ui';
import { prepareForRecognition } from '@/services/imageService';
import { RedactionUnavailableError } from '@/services/redaction';
import { recognitionConfig, useHaptics } from '@/state/AppProvider';
import { startScanSession } from '@/state/scanSession';
import { colors, radius, space } from '@/theme/tokens';

type Phase = 'idle' | 'capturing' | 'processing' | 'error';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  // Synchronous guard so a double tap cannot start two captures.
  const captureLock = useRef(false);
  const haptics = useHaptics();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const capture = async () => {
    if (!camera.current || captureLock.current) return;
    captureLock.current = true;
    setPhase('capturing');
    setError(null);
    haptics.impact();
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85, exif: false, base64: false });
      if (!photo) throw new Error('No photo was returned by the camera.');
      setPhase('processing');
      const prepared = await prepareForRecognition(photo.uri, photo.width, photo.height);
      const id = Crypto.randomUUID();
      startScanSession({
        id,
        image: { base64: prepared.base64, width: prepared.width, height: prepared.height },
        previewUri: prepared.previewUri,
        redactedRegions: prepared.redactedRegions,
        result: null,
        createdAt: Date.now(),
      });
      router.replace({ pathname: '/identify', params: { scanId: id } });
    } catch (e) {
      haptics.error();
      setPhase('error');
      setError(
        e instanceof RedactionUnavailableError
          ? 'Privacy protection could not run on this photo, so it was discarded and nothing was sent. Try again.'
          : e instanceof Error
            ? e.message
            : 'Capture failed.',
      );
      captureLock.current = false;
    }
  };

  /** Development-only path for simulators without a camera. Clearly labelled and absent in release builds. */
  const simulate = () => {
    const id = Crypto.randomUUID();
    startScanSession({ id, image: null, previewUri: null, result: null, createdAt: Date.now() });
    router.replace({ pathname: '/identify', params: { scanId: id } });
  };

  const header = (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={close} style={styles.roundBtn}>
        <Icon name="close" size={22} />
      </Pressable>
      <DevModeBanner />
      {permission?.granted ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel="Torch"
          onPress={() => setTorch((t) => !t)}
          style={[styles.roundBtn, torch && { backgroundColor: colors.accent }]}
        >
          <Icon name="flash" size={20} color={torch ? colors.accentInk : colors.text} />
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
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <View style={styles.permission}>
          <View style={styles.permIcon}>
            <Icon name="scan" size={30} color={colors.accent} />
          </View>
          <Txt variant="h2" align="center">
            Camera access needed
          </Txt>
          <Txt variant="body" color={colors.textMuted} align="center">
            The scanner uses your camera only while it is open, to photograph vehicles you choose to identify.
          </Txt>
          {permission.canAskAgain ? (
            <Button label="Allow camera" icon="scan" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
          )}
          {recognitionConfig.mode === 'mock' && (
            <Button label="Simulate capture (dev)" variant="secondary" onPress={simulate} />
          )}
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
        enableTorch={torch}
        animateShutter
        onCameraReady={() => setReady(true)}
        onMountError={(e) => {
          setPhase('error');
          setError(e.message);
        }}
      />
      <ScanOverlay
        active={ready && !busy}
        label={phase === 'processing' ? 'PROCESSING FRAME…' : ready ? 'FRAME THE WHOLE VEHICLE' : 'INITIALISING OPTICS…'}
      />
      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'bottom']} pointerEvents="box-none">
        {header}
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View style={styles.bottom}>
          {error && <Notice tone="danger" title="Capture failed" body={error} />}
          <View style={styles.hint}>
            <Icon name="shield" size={14} color={colors.blue} />
            <Txt variant="small" color={colors.textMuted}>
              Never scan while driving. Stay on public ground.
            </Txt>
          </View>
          <View style={styles.shutterRow}>
            <View style={{ width: 64 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
              accessibilityState={{ disabled: !ready || busy, busy }}
              disabled={!ready || busy}
              onPress={() => void capture()}
              style={({ pressed }) => [styles.shutter, (pressed || busy) && { transform: [{ scale: 0.94 }] }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <View style={styles.shutterInner}>
                  <GradientFill />
                </View>
              )}
            </Pressable>
            {recognitionConfig.mode === 'mock' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simulate capture, development only"
                onPress={simulate}
                style={styles.simBtn}
              >
                <Txt variant="label" color={colors.warning}>
                  SIM
                </Txt>
              </Pressable>
            ) : (
              <View style={{ width: 64 }} />
            )}
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: colors.bg },
  permIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    margin: space.md,
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.overlay,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,242,255,0.10)',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  simBtn: {
    width: 64,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
