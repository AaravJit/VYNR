/**
 * The scanner is the first screen after onboarding. Without camera permission
 * it explains why the camera is needed and never starts capture.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { catalog } from '@/catalog';
import { migrate } from '@/db/migrations';
import { GAME_CONFIG } from '@/domain/config';
import { AppProvider } from '@/state/AppProvider';
import { AppStore } from '@/state/appStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { idFactory } from '../helpers/fixtures';
import { NodeSqlDriver } from '../helpers/nodeDriver';

const mockRequest = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: false, canAskAgain: true };
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [mockPermission, mockRequest],
}));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ router: mockRouter, useIsFocused: () => true }));
jest.mock('@/db/expoDriver', () => ({ ExpoSqlDriver: { open: jest.fn() } }));
jest.mock('@/services/imageService', () => ({ prepareForRecognition: jest.fn(), deleteAllPhotos: jest.fn() }));
jest.mock('@/services/sound', () => ({ playSound: jest.fn() }));

async function readyStore() {
  const driver = NodeSqlDriver.open(':memory:');
  await migrate(driver);
  const s = new AppStore({ openDriver: async () => driver, catalog, config: GAME_CONFIG, newId: idFactory('sc') });
  await s.init();
  await s.completeOnboarding('Tester', true);
  return s;
}

it('asks for camera access with a clear reason and never captures without it', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  const Scanner = require('@/app/(tabs)/index').default;
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <AppProvider store={await readyStore()}>
        <Scanner />
      </AppProvider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText('Point. Shoot. Collect.')).toBeTruthy();
  expect(screen.getByText(/nothing is\s+sent until you press the shutter/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Allow camera'));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Capture photo')).toBeNull();
});

it('shows the shutter, disabled until the camera is ready', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const Scanner = require('@/app/(tabs)/index').default;
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <AppProvider store={await readyStore()}>
        <Scanner />
      </AppProvider>
    </SafeAreaProvider>,
  );
  const shutter = await screen.findByLabelText('Capture photo');
  expect(shutter.props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByText(`0/${catalog.vehicles.length}`)).toBeTruthy();
});
