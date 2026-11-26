/**
 * @jest-environment node
 *
 * Integration tests against a real SQLite engine (node:sqlite) using the exact
 * production migrations, repository and store code.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { catalog } from '@/catalog';
import { LATEST_SCHEMA_VERSION, migrate } from '@/db/migrations';
import { GameRepository } from '@/db/repository';
import { GAME_CONFIG } from '@/domain/config';
import { periodKey } from '@/domain/time';
import { CLIENT_DAILY_RECOGNITION_LIMIT } from '@/recognition/config';
import { GameService } from '@/services/gameService';
import { AppStore } from '@/state/appStore';

import { HOUR, idFactory, T0 } from '../helpers/fixtures';
import { NodeSqlDriver } from '../helpers/nodeDriver';

let dir: string;
let dbPath: string;
const opened: NodeSqlDriver[] = [];

function open(): NodeSqlDriver {
  const d = NodeSqlDriver.open(dbPath);
  opened.push(d);
  return d;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vynr-'));
  dbPath = join(dir, 'vynr.db');
});

afterEach(() => {
  while (opened.length) opened.pop()!.close();
  rmSync(dir, { recursive: true, force: true });
});

function clockAt(t: number) {
  const c = { t, now: () => c.t };
  return c;
}

describe('migrations', () => {
  it('migrate to the latest version and are idempotent', async () => {
    const db = open();
    expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(await migrate(db)).toBe(LATEST_SCHEMA_VERSION);
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['awards', 'contracts', 'encounters', 'player', 'recognition_usage', 'settings', 'xp_ledger']),
    );
  });

  it('enforce data constraints', async () => {
    const db = open();
    await migrate(db);
    await expect(
      db.run(
        "INSERT INTO encounters (id, vehicle_id, label, source, confidence, provider, xp_awarded, encounter_index, is_first, photo_uri, created_at) VALUES ('x', NULL, NULL, 'hacked', NULL, NULL, 5, 0, 0, NULL, 0)",
      ),
    ).rejects.toThrow();
    await expect(db.run("INSERT INTO xp_ledger (id, amount, reason, ref_id, created_at) VALUES ('l', -5, 'encounter', 'r', 0)")).rejects.toThrow();
  });
});

describe('GameService + repository', () => {
  it('persists encounters atomically and reloads identical state after restart', async () => {
    const clock = clockAt(T0);
    let db = open();
    await migrate(db);
    let repo = new GameRepository(db);
    const service = new GameService(repo, catalog, GAME_CONFIG, idFactory(), clock);
    const player = await service.init();

    const o1 = await service.recordEncounter(player.id, {
      vehicleId: 'ferrari-f40',
      label: null,
      source: 'ai_confirmed',
      confidence: 0.92,
      provider: 'remote',
      photoUri: null,
    });
    clock.t += HOUR;
    await service.recordEncounter(player.id, {
      vehicleId: 'ferrari-f40',
      label: null,
      source: 'ai_corrected',
      confidence: 0.4,
      provider: 'remote',
      photoUri: null,
    });
    const before = await repo.loadSnapshot(player.id);
    expect(o1.encounter.xpAwarded).toBe(1500);
    expect(before.encounters.map((e) => e.xpAwarded)).toEqual([1500, 600]);
    expect(before.totalXp).toBe((await repo.listLedger()).reduce((s, l) => s + l.amount, 0));

    // "Close and reopen the app": new connection, new repository.
    db.close();
    opened.splice(opened.indexOf(db), 1);
    db = open();
    await migrate(db);
    repo = new GameRepository(db);
    const after = await repo.loadSnapshot(player.id);
    expect(after).toEqual(before);
    expect((await repo.getPlayer())?.id).toBe(player.id);
  });

  it('rolls back every write when persisting an outcome fails', async () => {
    const db = open();
    await migrate(db);
    const repo = new GameRepository(db);
    const service = new GameService(repo, catalog, GAME_CONFIG, () => 'dup-id', clockAt(T0));
    const player = await repo.createPlayer('p', 'Tester', T0);
    // Every generated id is identical, so the second ledger insert violates the primary key.
    await expect(
      service.recordEncounter(player.id, { vehicleId: 'ferrari-f40', label: null, source: 'manual', confidence: null, provider: null, photoUri: null }),
    ).rejects.toThrow();
    expect(await repo.listEncounters()).toHaveLength(0);
    expect(await repo.totalXp()).toBe(0);
  });

  it('creates current contracts once per period', async () => {
    const clock = clockAt(T0);
    const db = open();
    await migrate(db);
    const repo = new GameRepository(db);
    const service = new GameService(repo, catalog, GAME_CONFIG, idFactory(), clock);
    const player = await service.init();
    await service.refreshContracts(player.id);
    const contracts = await repo.listContracts();
    expect(contracts.filter((c) => c.periodKey === periodKey('daily', T0))).toHaveLength(GAME_CONFIG.dailyContractCount);
    expect(contracts.filter((c) => c.periodKey === periodKey('weekly', T0))).toHaveLength(GAME_CONFIG.weeklyContractCount);
    clock.t += 24 * HOUR;
    await service.refreshContracts(player.id);
    expect((await repo.listContracts()).length).toBe(contracts.length + GAME_CONFIG.dailyContractCount);
  });
});

describe('AppStore (acceptance flow)', () => {
  function makeStore(clock = clockAt(T0), deleted: string[][] = []) {
    return new AppStore({
      openDriver: async () => open(),
      catalog,
      config: GAME_CONFIG,
      newId: idFactory(`s${Math.random()}`),
      clock,
      deletePhotos: (uris) => deleted.push(uris),
    });
  }

  it('onboards, records an encounter, earns XP and survives a restart', async () => {
    const store = makeStore();
    await store.init();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().player?.onboardedAt).toBeNull();

    expect(await store.completeOnboarding('x', true)).toBe(false); // invalid username
    expect(await store.completeOnboarding('NightApex', true)).toBe(true);
    const s1 = store.getState();
    expect(s1.player?.username).toBe('NightApex');
    expect(s1.settings).toMatchObject({ cloudRecognitionConsent: true, safetyAcknowledged: true });

    const outcome = await store.recordEncounter({
      vehicleId: 'toyota-gr-supra-j29',
      label: null,
      source: 'ai_confirmed',
      confidence: 0.86,
      provider: 'remote',
      photoUri: null,
    });
    const s2 = store.getState();
    expect(outcome.encounter.isFirstDiscovery).toBe(true);
    expect(s2.totalXp).toBe(outcome.totalXpAwarded);
    expect(s2.totalXp).toBeGreaterThanOrEqual(250);
    expect(s2.stats.uniqueVehicles).toBe(1);
    expect(s2.achievements.find((a) => a.key === 'first_contact')?.unlockedAt).not.toBeNull();
    const { daily, weekly } = store.currentContracts();
    expect(daily.length + weekly.length).toBeGreaterThan(0);
    // spot_any / new_discovery contracts (when generated) must reflect the encounter
    for (const c of [...daily, ...weekly]) {
      if (c.objective.kind === 'spot_any' || c.objective.kind === 'new_discovery') expect(c.progress).toBe(1);
    }

    // Reopen
    const reopened = makeStore();
    await reopened.init();
    const s3 = reopened.getState();
    expect(s3.player).toEqual(s2.player);
    expect(s3.totalXp).toBe(s2.totalXp);
    expect(s3.encounters).toEqual(s2.encounters);
    expect(s3.awards).toEqual(s2.awards);
  });

  it('enforces the client-side daily recognition limit', async () => {
    const store = makeStore();
    await store.init();
    expect(await store.recognitionAllowance()).toBe(CLIENT_DAILY_RECOGNITION_LIMIT);
    for (let i = 0; i < CLIENT_DAILY_RECOGNITION_LIMIT; i++) await store.noteRecognitionUsed();
    expect(await store.recognitionAllowance()).toBe(0);
  });

  it('exports all data without device paths, then deletes everything including photos', async () => {
    const deleted: string[][] = [];
    const store = makeStore(clockAt(T0), deleted);
    await store.init();
    await store.completeOnboarding('Exporter', false);
    await store.recordEncounter({
      vehicleId: 'kia-ev6',
      label: null,
      source: 'manual',
      confidence: null,
      provider: null,
      photoUri: 'file:///data/photos/abc.jpg',
    });
    const exported = await store.exportData();
    expect(exported).toMatchObject({ format: 'vynr-export', player: { username: 'Exporter' } });
    expect(JSON.stringify(exported)).not.toContain('file:///');
    expect((exported.encounters as { hasPhoto: boolean }[])[0]?.hasPhoto).toBe(true);

    const oldId = store.getState().player?.id;
    await store.deleteAllData();
    const s = store.getState();
    expect(deleted).toEqual([['file:///data/photos/abc.jpg']]);
    expect(s.encounters).toHaveLength(0);
    expect(s.totalXp).toBe(0);
    expect(s.player?.id).not.toBe(oldId);
    expect(s.player?.onboardedAt).toBeNull();
    expect(s.settings.cloudRecognitionConsent).toBe(false);
  });

  it('surfaces database failures as an error state instead of crashing', async () => {
    const store = new AppStore({
      openDriver: async () => {
        throw new Error('disk full');
      },
      catalog,
      config: GAME_CONFIG,
      newId: idFactory(),
    });
    await store.init();
    expect(store.getState()).toMatchObject({ status: 'error', error: 'disk full' });
  });
});
