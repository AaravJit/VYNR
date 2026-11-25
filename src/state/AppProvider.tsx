import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { catalog } from '@/catalog';
import { ExpoSqlDriver } from '@/db/expoDriver';
import { GAME_CONFIG } from '@/domain/config';
import { appRecognitionConfig, type RecognitionConfig } from '@/recognition/config';
import { MockRecognitionProvider } from '@/recognition/mockProvider';
import { RemoteRecognitionProvider } from '@/recognition/remoteProvider';
import type { RecognitionProvider } from '@/recognition/types';
import { deleteAllPhotos, deleteFileQuietly } from '@/services/imageService';

import { AppStore, type AppState } from './appStore';

const StoreContext = createContext<AppStore | null>(null);

export function createAppStore(): AppStore {
  return new AppStore({
    openDriver: () => ExpoSqlDriver.open(),
    catalog,
    config: GAME_CONFIG,
    newId: () => Crypto.randomUUID(),
    deletePhotos: deleteAllPhotos,
    deletePhoto: deleteFileQuietly,
  });
}

export function AppProvider({ children, store: injected }: { children: ReactNode; store?: AppStore }) {
  const [store] = useState(() => injected ?? createAppStore());
  useEffect(() => {
    void store.init();
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useAppStore must be used inside <AppProvider>');
  return s;
}

export function useAppState(): AppState {
  const store = useAppStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Haptic feedback that respects the player's setting and degrades silently on web. */
export function useHaptics() {
  const store = useContext(StoreContext);
  const enabled = useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    () => store?.getState().settings.hapticsEnabled ?? false,
    () => false,
  );
  return useMemo(() => {
    const on = enabled && Platform.OS !== 'web';
    const safe = (fn: () => Promise<void>) => {
      if (on) fn().catch(() => undefined);
    };
    return {
      selection: () => safe(() => Haptics.selectionAsync()),
      impact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    };
  }, [enabled]);
}

export const recognitionConfig: RecognitionConfig = appRecognitionConfig();

let cachedProvider: RecognitionProvider | null = null;
let cachedFor: string | null = null;

/** Anonymous, non-reversible install identifier used only for server-side rate limiting. */
export async function rateLimitId(playerId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `vynr-rate-limit:${playerId}`);
  return digest.slice(0, 32);
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export async function getRecognitionProvider(playerId: string): Promise<RecognitionProvider | null> {
  const cfg = recognitionConfig;
  if (cfg.mode === 'unconfigured') return null;
  // Belt and braces: config resolution already refuses mock outside development,
  // but a simulated provider must never be constructed in a release build.
  if (cfg.mode === 'mock' && !isDevBuild()) return null;
  const key = `${cfg.mode}:${cfg.endpoint}:${playerId}`;
  if (cachedProvider && cachedFor === key) return cachedProvider;
  cachedProvider =
    cfg.mode === 'mock'
      ? new MockRecognitionProvider(catalog)
      : new RemoteRecognitionProvider({ endpoint: cfg.endpoint!, installId: await rateLimitId(playerId) });
  cachedFor = key;
  return cachedProvider;
}
