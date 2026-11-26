/**
 * With a real (remote) recognition service configured, photos must never be
 * sent without consent, and the daily cap must stop requests.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { catalog } from '@/catalog';
import { migrate } from '@/db/migrations';
import { GAME_CONFIG } from '@/domain/config';
import { CLIENT_DAILY_RECOGNITION_LIMIT } from '@/recognition/config';
import { AppProvider } from '@/state/AppProvider';
import { AppStore } from '@/state/appStore';
import { startScanSession } from '@/state/scanSession';

import { idFactory } from '../helpers/fixtures';
import { NodeSqlDriver } from '../helpers/nodeDriver';

const mockFetch = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ scanId: 'remote-scan' }),
}));
jest.mock('@/db/expoDriver', () => ({ ExpoSqlDriver: { open: jest.fn() } }));
jest.mock('@/services/imageService', () => ({ saveThumbnail: jest.fn(), deleteAllPhotos: jest.fn() }));
jest.mock('@/services/sound', () => ({ playSound: jest.fn() }));
jest.mock('@/recognition/config', () => ({
  ...jest.requireActual('@/recognition/config'),
  appRecognitionConfig: () => ({ mode: 'remote', endpoint: 'https://recognition.example.com' }),
}));

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  startScanSession({
    id: 'remote-scan',
    image: { base64: '/9j/AAAA', width: 800, height: 600 },
    previewUri: null,
    redaction: { status: 'redacted', faces: 0, plates: 1 },
    result: null,
    createdAt: Date.now(),
  });
});

async function store(consent: boolean) {
  const driver = NodeSqlDriver.open(':memory:');
  await migrate(driver);
  const s = new AppStore({ openDriver: async () => driver, catalog, config: GAME_CONFIG, newId: idFactory('r') });
  await s.init();
  await s.completeOnboarding('Remote', consent);
  return s;
}

it('does not upload anything without consent and offers manual identification', async () => {
  const s = await store(false);
  const Identify = require('@/app/identify').default;
  await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  expect(await screen.findByText('Cloud identification is off')).toBeTruthy();
  expect(screen.getByLabelText('Choose from catalog')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('calls the recognition service once consent is granted', async () => {
  mockFetch.mockResolvedValue(
    new Response(
      JSON.stringify({ vehicleDetected: true, candidates: [{ make: 'Porsche', model: '911', generation: '992', confidence: 0.93 }], notes: null }),
      { status: 200 },
    ),
  );
  const s = await store(false);
  const Identify = require('@/app/identify').default;
  await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  await fireEvent.press(await screen.findByLabelText('Allow cloud identification'));
  expect(await screen.findByText('AI PREDICTION')).toBeTruthy();
  expect(screen.getByText('Strong match')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(await s.recognitionAllowance()).toBe(CLIENT_DAILY_RECOGNITION_LIMIT - 1);
});

it('stops calling the service when the daily cap is reached', async () => {
  const s = await store(true);
  for (let i = 0; i < CLIENT_DAILY_RECOGNITION_LIMIT; i++) await s.noteRecognitionUsed();
  const Identify = require('@/app/identify').default;
  await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  expect(await screen.findByText('Daily identification limit reached')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('does not upload when consent is revoked while recognition is starting', async () => {
  const s = await store(true);
  // Revoke consent during the allowance check, after the screen has decided to recognise.
  const realAllowance = s.recognitionAllowance.bind(s);
  jest.spyOn(s, 'recognitionAllowance').mockImplementation(async () => {
    const left = await realAllowance();
    await s.setSetting('cloudRecognitionConsent', false);
    return left;
  });
  const Identify = require('@/app/identify').default;
  await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  expect(await screen.findByText('Cloud identification is off')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('does not upload after the screen is closed mid-start', async () => {
  const s = await store(true);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const realAllowance = s.recognitionAllowance.bind(s);
  jest.spyOn(s, 'recognitionAllowance').mockImplementation(async () => {
    await gate;
    return realAllowance();
  });
  const Identify = require('@/app/identify').default;
  const view = await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  await view.unmount();
  release();
  await new Promise((r) => setTimeout(r, 50));
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each(['unavailable', 'failed'] as const)('never uploads a photo whose faces and plates were not blurred (%s)', async (status) => {
  startScanSession({
    id: 'remote-scan',
    image: { base64: '/9j/AAAA', width: 800, height: 600 },
    previewUri: null,
    redaction: { status, faces: 0, plates: 0 },
    result: null,
    createdAt: Date.now(),
  });
  const s = await store(true);
  const Identify = require('@/app/identify').default;
  await render(
    <AppProvider store={s}>
      <Identify />
    </AppProvider>,
  );
  expect(await screen.findByText('Photo kept on this phone')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
  // No allowance is consumed for a scan that never left the phone.
  expect(await s.recognitionAllowance()).toBe(CLIENT_DAILY_RECOGNITION_LIMIT);
});
