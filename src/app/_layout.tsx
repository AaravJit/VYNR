import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular';
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { InterTight_700Bold } from '@expo-google-fonts/inter-tight/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded/800ExtraBold';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { AppProvider, useAppState, useAppStore } from '@/state/AppProvider';
import { colors, space } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Route-level error boundary: any uncaught render error lands here instead of crashing. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.center}>
      <Txt variant="label" color={colors.danger} upper>
        System fault
      </Txt>
      <Txt variant="h2" align="center">
        Something went wrong
      </Txt>
      <Txt variant="small" color={colors.textMuted} align="center">
        {error.message}
      </Txt>
      <Button label="Try again" icon="refresh" onPress={() => void retry()} />
    </View>
  );
}

function RootNavigator() {
  const state = useAppState();
  const store = useAppStore();
  const [fontsLoaded, fontError] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    JetBrainsMono_500Medium,
    Unbounded_600SemiBold,
    Unbounded_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  const ready = fontsReady && state.status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Txt variant="h2" align="center">
          Could not open your garage
        </Txt>
        <Txt variant="small" color={colors.textMuted} align="center">
          {state.error}
        </Txt>
        <Button label="Retry" icon="refresh" onPress={() => void store.init()} />
      </View>
    );
  }

  const onboarded = state.player?.onboardedAt != null;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="identify" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="catalog-picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="discovery/[encounterId]" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="vehicle/[vehicleId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
});
