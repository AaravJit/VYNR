/**
 * The scanner is the first screen after onboarding and scans automatically.
 * Without camera permission it explains why the camera is needed and never
 * starts sampling; with permission it waits for the camera before scanning.
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
jest.mock('@/services/imageService', () => ({
  prepareForRecognition: jest.fn(),
  measureFrame: jest.fn(),
  deleteAllPhotos: jest.fn(),
  deleteFileQuietly: jest.fn(),
}));
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
  expect(await screen.findByText('Point at a car. VYNR does the rest.')).toBeTruthy();
  expect(screen.getByText(/blurs faces and\s+plates, and sends a photo only when a car is in clear view/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Allow camera'));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  const { measureFrame, prepareForRecognition } = jest.requireMock('@/services/imageService');
  expect(measureFrame).not.toHaveBeenCalled();
  expect(prepareForRecognition).not.toHaveBeenCalled();
});

it('has no shutter and does not sample until the camera is ready', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const Scanner = require('@/app/(tabs)/index').default;
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <AppProvider store={await readyStore()}>
        <Scanner />
      </AppProvider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByLabelText('Starting camera…')).toBeTruthy();
  expect(screen.queryByLabelText('Capture photo')).toBeNull();
  expect(screen.getByText('Never scan while driving, and stay out of the road.')).toBeTruthy();
  const { measureFrame } = jest.requireMock('@/services/imageService');
  expect(measureFrame).not.toHaveBeenCalled();
});
