import type {
  AwardRecord,
  Contract,
  ContractObjective,
  EncounterRecord,
  EncounterSource,
  GameSnapshot,
  LedgerEntry,
} from '@/domain/types';
import type { EncounterOutcome } from '@/domain/engine';

import type { SqlDriver } from './driver';
import { LATEST_SCHEMA_VERSION } from './migrations';

export interface Player {
  id: string;
  username: string;
  createdAt: number;
  onboardedAt: number | null;
}

export interface Settings {
  hapticsEnabled: boolean;
  keepPhotos: boolean;
  /** Consent to send captured photos to the recognition service. */
  cloudRecognitionConsent: boolean;
  safetyAcknowledged: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  hapticsEnabled: true,
  keepPhotos: false,
  cloudRecognitionConsent: false,
  safetyAcknowledged: false,
};

interface EncounterRow {
  id: string;
  vehicle_id: string | null;
  label: string | null;
  source: EncounterSource;
  confidence: number | null;
  provider: string | null;
  xp_awarded: number;
  encounter_index: number;
  is_first: number;
  photo_uri: string | null;
  created_at: number;
}

interface ContractRow {
  id: string;
  period: 'daily' | 'weekly';
  period_key: string;
  objective: string;
  target: number;
  progress: number;
  reward_xp: number;
  completed_at: number | null;
  created_at: number;
}

const toEncounter = (r: EncounterRow): EncounterRecord => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  label: r.label,
  source: r.source,
  confidence: r.confidence,
  provider: r.provider,
  xpAwarded: r.xp_awarded,
  encounterIndex: r.encounter_index,
  isFirstDiscovery: r.is_first === 1,
  photoUri: r.photo_uri,
  createdAt: r.created_at,
});

const toContract = (r: ContractRow): Contract => ({
  id: r.id,
  period: r.period,
  periodKey: r.period_key,
  objective: JSON.parse(r.objective) as ContractObjective,
  target: r.target,
  progress: r.progress,
  rewardXp: r.reward_xp,
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

export class GameRepository {
  constructor(private readonly db: SqlDriver) {}

  // ── Player ──────────────────────────────────────────────────────────
  async getPlayer(): Promise<Player | null> {
    const row = await this.db.first<{ id: string; username: string; created_at: number; onboarded_at: number | null }>(
      'SELECT id, username, created_at, onboarded_at FROM player LIMIT 1',
    );
    return row
      ? { id: row.id, username: row.username, createdAt: row.created_at, onboardedAt: row.onboarded_at }
      : null;
  }

  async createPlayer(id: string, username: string, now: number): Promise<Player> {
    await this.db.run('INSERT INTO player (id, username, created_at, onboarded_at) VALUES (?, ?, ?, NULL)', [
      id,
      username,
      now,
    ]);
    return { id, username, createdAt: now, onboardedAt: null };
  }

  async setUsername(username: string): Promise<void> {
    await this.db.run('UPDATE player SET username = ?', [username]);
  }

  async setOnboarded(now: number): Promise<void> {
    await this.db.run('UPDATE player SET onboarded_at = ?', [now]);
  }

  // ── Settings ────────────────────────────────────────────────────────
  async getSettings(): Promise<Settings> {
    const rows = await this.db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    const out: Settings = { ...DEFAULT_SETTINGS };
    for (const { key, value } of rows) {
      if (key in out) (out as unknown as Record<string, boolean>)[key] = value === 'true';
    }
    return out;
  }

  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    await this.db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value)],
    );
  }

  // ── Game state ──────────────────────────────────────────────────────
  async totalXp(): Promise<number> {
    const row = await this.db.first<{ total: number | null }>('SELECT SUM(amount) AS total FROM xp_ledger');
    return row?.total ?? 0;
  }

  async listEncounters(): Promise<EncounterRecord[]> {
    const rows = await this.db.all<EncounterRow>('SELECT * FROM encounters ORDER BY created_at ASC, id ASC');
    return rows.map(toEncounter);
  }

  async listContracts(): Promise<Contract[]> {
    const rows = await this.db.all<ContractRow>('SELECT * FROM contracts ORDER BY created_at ASC, id ASC');
    return rows.map(toContract);
  }

  async listAwards(): Promise<AwardRecord[]> {
    const rows = await this.db.all<{ key: string; kind: AwardRecord['kind']; xp: number; awarded_at: number }>(
      'SELECT * FROM awards ORDER BY awarded_at ASC',
    );
    return rows.map((r) => ({ key: r.key, kind: r.kind, xp: r.xp, awardedAt: r.awarded_at }));
  }

  async listLedger(): Promise<LedgerEntry[]> {
    const rows = await this.db.all<{ id: string; amount: number; reason: LedgerEntry['reason']; ref_id: string; created_at: number }>(
      'SELECT * FROM xp_ledger ORDER BY created_at ASC, id ASC',
    );
    return rows.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, refId: r.ref_id, createdAt: r.created_at }));
  }

  async loadSnapshot(playerId: string): Promise<GameSnapshot> {
    const [totalXp, encounters, contracts, awards] = await Promise.all([
      this.totalXp(),
      this.listEncounters(),
      this.listContracts(),
      this.listAwards(),
    ]);
    return { playerId, totalXp, encounters, contracts, awards };
  }

  async upsertContracts(contracts: Contract[]): Promise<void> {
    await this.db.transaction((tx) => GameRepository.writeContracts(tx, contracts));
  }

  private static async writeContracts(db: SqlDriver, contracts: Contract[]): Promise<void> {
    for (const c of contracts) {
      await db.run(
        `INSERT INTO contracts (id, period, period_key, objective, target, progress, reward_xp, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET progress = excluded.progress, completed_at = excluded.completed_at`,
        [
          c.id,
          c.period,
          c.periodKey,
          JSON.stringify(c.objective),
          c.target,
          c.progress,
          c.rewardXp,
          c.completedAt,
          c.createdAt,
        ],
      );
    }
  }

  /** Persists every effect of an encounter atomically. */
  async persistOutcome(outcome: EncounterOutcome): Promise<void> {
    await this.db.transaction(async (tx) => {
      const e = outcome.encounter;
      await tx.run(
        `INSERT INTO encounters (id, vehicle_id, label, source, confidence, provider, xp_awarded, encounter_index, is_first, photo_uri, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          e.vehicleId,
          e.label,
          e.source,
          e.confidence,
          e.provider,
          e.xpAwarded,
          e.encounterIndex,
          e.isFirstDiscovery ? 1 : 0,
          e.photoUri,
          e.createdAt,
        ],
      );
      for (const l of outcome.ledger) {
        await tx.run('INSERT INTO xp_ledger (id, amount, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?)', [
          l.id,
          l.amount,
          l.reason,
          l.refId,
          l.createdAt,
        ]);
      }
      await GameRepository.writeContracts(tx, outcome.contracts);
      for (const a of outcome.awards) {
        await tx.run('INSERT INTO awards (key, kind, xp, awarded_at) VALUES (?, ?, ?, ?)', [
          a.key,
          a.kind,
          a.xp,
          a.awardedAt,
        ]);
      }
    });
  }

  // ── Recognition usage (client-side cost control) ────────────────────
  async recognitionCount(day: string): Promise<number> {
    const row = await this.db.first<{ count: number }>('SELECT count FROM recognition_usage WHERE day = ?', [day]);
    return row?.count ?? 0;
  }

  async incrementRecognition(day: string): Promise<void> {
    await this.db.run(
      'INSERT INTO recognition_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1',
      [day],
    );
  }

  // ── Privacy ─────────────────────────────────────────────────────────
  async exportAll(): Promise<Record<string, unknown>> {
    const [player, settings, encounters, ledger, contracts, awards] = await Promise.all([
      this.getPlayer(),
      this.getSettings(),
      this.listEncounters(),
      this.listLedger(),
      this.listContracts(),
      this.listAwards(),
    ]);
    return {
      format: 'vynr-export',
      schemaVersion: LATEST_SCHEMA_VERSION,
      player,
      settings,
      // Photo file paths are device-local and meaningless elsewhere; omit them.
      encounters: encounters.map(({ photoUri, ...rest }) => ({ ...rest, hasPhoto: photoUri !== null })),
      xpLedger: ledger,
      contracts,
      awards,
    };
  }

  /** Returns photo URIs so the caller can delete the files. */
  async wipeAll(): Promise<string[]> {
    const photos = await this.db.all<{ photo_uri: string }>(
      'SELECT photo_uri FROM encounters WHERE photo_uri IS NOT NULL',
    );
    await this.db.transaction(async (tx) => {
      for (const t of ['encounters', 'xp_ledger', 'contracts', 'awards', 'recognition_usage', 'settings', 'player']) {
        await tx.run(`DELETE FROM ${t}`);
      }
    });
    return photos.map((p) => p.photo_uri);
  }
}
