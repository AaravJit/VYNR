/**
 * UI integration tests: real screens + real store + real SQLite (node:sqlite),
 * with only navigation mocked. Exercises the core acceptance path:
 * capture → simulated recognition → review → confirm → XP → persisted.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { catalog } from '@/catalog';
import { migrate } from '@/db/migrations';
import { GAME_CONFIG } from '@/domain/config';
import { AppProvider } from '@/state/AppProvider';
import { AppStore } from '@/state/appStore';
import { clearScanSession, getOutcome, startScanSession, updateScanSession } from '@/state/scanSession';

import { idFactory } from '../helpers/fixtures';
import { NodeSqlDriver } from '../helpers/nodeDriver';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissTo: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));

// expo-sqlite's native module is not available under Jest; the store below is injected with node:sqlite.
jest.mock('@/db/expoDriver', () => ({ ExpoSqlDriver: { open: jest.fn() } }));
jest.mock('@/services/imageService', () => ({ saveThumbnail: jest.fn(), deleteAllPhotos: jest.fn() }));

async function readyStore(onboard = true): Promise<AppStore> {
  const driver = NodeSqlDriver.open(':memory:');
  await migrate(driver);
  const store = new AppStore({ openDriver: async () => driver, catalog, config: GAME_CONFIG, newId: idFactory('ui') });
  await store.init();
  if (onboard) await store.completeOnboarding('Tester', true);
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  clearScanSession();
});

describe('Home', () => {
  it('shows level, collection progress, contracts and the empty state', async () => {
    const store = await readyStore();
    const Home = require('@/app/(tabs)/index').default;
    await render(
      <AppProvider store={store}>
        <Home />
      </AppProvider>,
    );
    expect(await screen.findByText('Tester')).toBeTruthy();
    expect(screen.getByText('No sightings yet')).toBeTruthy();
    expect(screen.getByText(`0/${catalog.vehicles.length}`)).toBeTruthy();
    expect(screen.getByText('DEV MODE · SIMULATED RECOGNITION')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open scanner'));
    expect(mockRouter.push).toHaveBeenCalledWith('/scan');
  });
});

describe('Identify flow', () => {
  it('runs simulated recognition, shows verified catalog data and records the encounter', async () => {
    const store = await readyStore();
    startScanSession({ id: 'scan-1', image: null, previewUri: null, result: null, createdAt: Date.now() });
    mockParams = { scanId: 'scan-1' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    expect(screen.getByText('RECOGNITION IN PROGRESS')).toBeTruthy();
    // Mock provider: ~900ms latency; it may also (5%) report "no vehicle" — both are valid UI states.
    await waitFor(
      () => expect(screen.queryByText('SIMULATED PREDICTION') ?? screen.queryByText('No vehicle detected')).toBeTruthy(),
      { timeout: 4000 },
    );
    if (screen.queryByText('No vehicle detected')) {
      // Correct manually instead.
      await act(() => updateScanSession('scan-1', { manualVehicleId: 'toyota-corolla-e210' }));
      expect(await screen.findByText('IDENTIFIED BY YOU')).toBeTruthy();
    }
    expect(screen.getByText('VERIFIED CATALOG RECORD')).toBeTruthy();
    expect(screen.getByText(/Trims and exact model years cannot be reliably determined/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Confirm & add to garage'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const [arg] = mockRouter.replace.mock.calls[0];
    expect(arg.pathname).toBe('/discovery/[encounterId]');
    const outcome = getOutcome(arg.params.encounterId);
    expect(outcome?.encounter.isFirstDiscovery).toBe(true);
    expect(store.getState().encounters).toHaveLength(1);
    expect(store.getState().totalXp).toBeGreaterThan(0);
  });

  it('lets the player correct the identification manually', async () => {
    const store = await readyStore();
    startScanSession({
      id: 'scan-2',
      image: null,
      previewUri: null,
      createdAt: Date.now(),
      result: {
        vehicleDetected: true,
        candidates: [{ make: 'Toyota', model: 'Camry', generation: 'XV70', confidence: 0.55 }],
        notes: null,
        provider: 'remote',
        simulated: false,
      },
    });
    mockParams = { scanId: 'scan-2' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    expect(await screen.findByText('AI PREDICTION')).toBeTruthy();
    expect(screen.getByText('Not certain')).toBeTruthy(); // 55% → moderate confidence warning
    await fireEvent.press(screen.getByLabelText('Not right? Choose another vehicle'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/catalog-picker', params: { scanId: 'scan-2' } });

    await act(() => updateScanSession('scan-2', { manualVehicleId: 'honda-accord-10' }));
    expect(await screen.findByText('IDENTIFIED BY YOU')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Confirm & add to garage'));
    await waitFor(() => expect(store.getState().encounters).toHaveLength(1));
    expect(store.getState().encounters[0]).toMatchObject({ vehicleId: 'honda-accord-10', source: 'ai_corrected', confidence: null });
  });

  it('keeps the identification on screen after a failed save, records once on retry, and ignores double taps', async () => {
    const store = await readyStore();
    startScanSession({
      id: 'scan-4',
      image: null,
      previewUri: null,
      createdAt: Date.now(),
      result: {
        vehicleDetected: true,
        candidates: [{ make: 'Kia', model: 'EV6', generation: null, confidence: 0.9 }],
        notes: null,
        provider: 'remote',
        simulated: false,
      },
    });
    mockParams = { scanId: 'scan-4' };
    const real = store.recordEncounter.bind(store);
    const spy = jest.spyOn(store, 'recordEncounter').mockRejectedValueOnce(new Error('disk full.'));
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Confirm & add to garage'));
    expect(await screen.findByText('Could not save this sighting')).toBeTruthy();
    expect(store.getState().encounters).toHaveLength(0);

    spy.mockImplementation(real);
    const button = screen.getByLabelText('Confirm & add to garage');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(store.getState().encounters).toHaveLength(1);
    expect(store.getState().encounters[0]).toMatchObject({ vehicleId: 'kia-ev6', source: 'ai_confirmed' });
  });

  it('offers catalog correction when no prediction matches the catalog', async () => {
    const store = await readyStore();
    startScanSession({
      id: 'scan-5',
      image: null,
      previewUri: null,
      createdAt: Date.now(),
      result: {
        vehicleDetected: true,
        candidates: [{ make: 'Koenigsegg', model: 'Jesko', generation: null, confidence: 0.6 }],
        notes: null,
        provider: 'remote',
        simulated: false,
      },
    });
    mockParams = { scanId: 'scan-5' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    expect(await screen.findByText('Not in the VYNR catalog yet')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Choose the correct vehicle from the catalog'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/catalog-picker', params: { scanId: 'scan-5' } });
  });

  it('requires an explicit generation choice when several generations match', async () => {
    const store = await readyStore();
    startScanSession({
      id: 'scan-6',
      image: null,
      previewUri: null,
      createdAt: Date.now(),
      result: {
        vehicleDetected: true,
        candidates: [{ make: 'Ford', model: 'Mustang', generation: null, confidence: 0.9 }],
        notes: null,
        provider: 'remote',
        simulated: false,
      },
    });
    mockParams = { scanId: 'scan-6' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    expect(await screen.findByText('Which generation is it?')).toBeTruthy();
    expect(screen.queryByLabelText('Confirm & add to garage')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^Select Ford Mustang S650/));
    await fireEvent.press(await screen.findByLabelText('Confirm & add to garage'));
    await waitFor(() => expect(store.getState().encounters).toHaveLength(1));
    expect(store.getState().encounters[0]?.vehicleId).toBe('ford-mustang-s650');
  });

  it('runs simulated recognition on-device in development builds regardless of cloud consent', async () => {
    const store = await readyStore();
    await store.setSetting('cloudRecognitionConsent', false);
    startScanSession({ id: 'scan-3', image: null, previewUri: null, result: null, createdAt: Date.now() });
    mockParams = { scanId: 'scan-3' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    // In development builds recognition is simulated on-device, so consent only gates the remote service.
    await waitFor(() => expect(screen.queryByText('RECOGNITION IN PROGRESS')).toBeNull(), { timeout: 4000 });
  });

  it('explains when a scan has expired', async () => {
    const store = await readyStore();
    mockParams = { scanId: 'missing' };
    const Identify = require('@/app/identify').default;
    await render(
      <AppProvider store={store}>
        <Identify />
      </AppProvider>,
    );
    expect(await screen.findByText('This scan has expired')).toBeTruthy();
  });
});
