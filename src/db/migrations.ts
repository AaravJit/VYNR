import type { SqlDriver } from './driver';

/**
 * Ordered, append-only schema migrations. Never edit a shipped migration; add a
 * new one. The applied version is tracked in PRAGMA user_version.
 */
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE IF NOT EXISTS player (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        onboarded_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS encounters (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT,
        label TEXT,
        source TEXT NOT NULL CHECK (source IN ('ai_confirmed','ai_corrected','manual','simulated')),
        confidence REAL,
        provider TEXT,
        xp_awarded INTEGER NOT NULL CHECK (xp_awarded >= 0),
        encounter_index INTEGER NOT NULL,
        is_first INTEGER NOT NULL,
        photo_uri TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_encounters_vehicle ON encounters(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_encounters_created ON encounters(created_at);

      CREATE TABLE IF NOT EXISTS xp_ledger (
        id TEXT PRIMARY KEY NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        reason TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY NOT NULL,
        period TEXT NOT NULL CHECK (period IN ('daily','weekly')),
        period_key TEXT NOT NULL,
        objective TEXT NOT NULL,
        target INTEGER NOT NULL,
        progress INTEGER NOT NULL,
        reward_xp INTEGER NOT NULL,
        completed_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_contracts_period ON contracts(period_key);

      CREATE TABLE IF NOT EXISTS awards (
        key TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        xp INTEGER NOT NULL,
        awarded_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recognition_usage (
        day TEXT PRIMARY KEY NOT NULL,
        count INTEGER NOT NULL
      );
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export async function migrate(db: SqlDriver): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
