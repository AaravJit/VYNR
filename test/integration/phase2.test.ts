/**
 * @jest-environment node
 *
 * Phase 2 regressions against real SQLite: the v2 intel column migrates an
 * existing v1 database in place, intel survives a restart, and a photo saved
 * for an encounter that failed to record is deleted.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { catalog } from '@/catalog';
import { LATEST_SCHEMA_VERSION, migrate, MIGRATIONS } from '@/db/migrations';
import { GAME_CONFIG } from '@/domain/config';
import { generateIntel } from '@/domain/intel';
import { AppStore } from '@/state/appStore';

import { idFactory, T0 } from '../helpers/fixtures';
import { NodeSqlDriver } from '../helpers/nodeDriver';

let dir: string;
let dbPath: string;
const opened: NodeSqlDriver[] = [];
const open = () => {
  const d = NodeSqlDriver.open(dbPath);
  opened.push(d);
  return d;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vynr-p2-'));
  dbPath = join(dir, 'vynr.db');
});
afterEach(() => {
  while (opened.length) opened.pop()!.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeStore(extra: { deletePhoto?: (uri: string) => void } = {}) {
  return new AppStore({
    openDriver: async () => open(),
    catalog,
    config: GAME_CONFIG,
    newId: idFactory(`p2${Math.random()}`),
    clock: { now: () => T0 },
    ...extra,
  });
}

const vehicle = catalog.getVehicle('porsche-911-992')!;
const intel = generateIntel({ vehicle, country: catalog.countryOf(vehicle), seed: 'scan-a' });

it('upgrades a v1 database in place, keeping existing encounters', async () => {
  const db = open();
  // Build a database exactly as a v1 install left it.
  await db.exec(MIGRATIONS.find((m) => m.version === 1)!.sql);
  await db.exec('PRAGMA user_version = 1');
  await db.run(
    "INSERT INTO encounters (id, vehicle_id, label, source, confidence, provider, xp_awarded, encounter_index, is_first, photo_uri, created_at) VALUES ('old', 'ferrari-f40', NULL, 'manual', NULL, NULL, 1500, 0, 1, NULL, 1)",
  );
  expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
  const row = await db.first<{ id: string; intel: string | null }>("SELECT id, intel FROM encounters WHERE id = 'old'");
  expect(row).toEqual({ id: 'old', intel: null });
});

it('stores intel with the encounter and reloads it unchanged after a restart', async () => {
  const store = makeStore();
  await store.init();
  await store.completeOnboarding('Spotter', false);
  await store.recordEncounter({
    vehicleId: vehicle.id,
    label: null,
    source: 'manual',
    confidence: null,
    provider: null,
    photoUri: null,
    intel,
  });
  const reopened = makeStore();
  await reopened.init();
  expect(reopened.getState().encounters[0]!.intel).toEqual(intel);
});

it('never stores intel on a field note (no catalog vehicle)', async () => {
  const store = makeStore();
  await store.init();
  await store.completeOnboarding('Spotter', false);
  const o = await store.recordEncounter({
    vehicleId: null,
    label: 'Mystery coupe',
    source: 'manual',
    confidence: null,
    provider: null,
    photoUri: null,
    intel,
  });
  expect(o.encounter.intel).toBeNull();
});

it('deletes the saved photo when recording the encounter fails', async () => {
  const deleted: string[] = [];
  const store = makeStore({ deletePhoto: (uri) => deleted.push(uri) });
  await store.init();
  await store.completeOnboarding('Spotter', false);
  await expect(
    store.recordEncounter({
      vehicleId: 'not-a-real-vehicle',
      label: null,
      source: 'manual',
      confidence: null,
      provider: null,
      photoUri: 'file:///photos/orphan.jpg',
    }),
  ).rejects.toThrow();
  expect(deleted).toEqual(['file:///photos/orphan.jpg']);
  expect(store.getState().encounters).toHaveLength(0);
});
