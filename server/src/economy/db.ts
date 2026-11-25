import { DatabaseSync } from 'node:sqlite';

/**
 * Versioned schema for the authoritative game economy. Migrations only move
 * forward in production; each has a `down` used by `scripts/economy-rollback.ts`
 * against a restored backup copy (see docs/BACKEND.md). Never edit a shipped
 * migration: add a new one.
 *
 * Integrity is enforced by the database as well as the code: balances cannot
 * go negative, a collectible has exactly one owner, a collectible can have at
 * most one active listing, and idempotency keys are unique per account.
 */
export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'accounts, wallet, ledger, collectibles, market, crates',
    up: `
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        handle TEXT UNIQUE,
        public_profile INTEGER NOT NULL DEFAULT 0 CHECK (public_profile IN (0, 1)),
        profile_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE tokens (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      );
      CREATE TABLE wallets (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
      );
      CREATE TABLE ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        delta INTEGER NOT NULL CHECK (delta <> 0),
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        reason TEXT NOT NULL,
        ref TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX ledger_account ON ledger(account_id, id);

      CREATE TABLE recognitions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        candidates_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1))
      );
      CREATE TABLE discoveries (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        recognition_id TEXT NOT NULL UNIQUE,
        first INTEGER NOT NULL CHECK (first IN (0, 1)),
        rewarded_vc INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        day TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX discoveries_account ON discoveries(account_id, vehicle_id);

      CREATE TABLE collectibles (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        serial INTEGER NOT NULL,
        colour TEXT NOT NULL,
        edition TEXT NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('discovered', 'unboxed', 'showroom')),
        owner_id TEXT,
        acquired_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        burned_at INTEGER,
        CHECK ((owner_id IS NULL) = (burned_at IS NOT NULL)),
        UNIQUE (vehicle_id, serial)
      );
      CREATE INDEX collectibles_owner ON collectibles(owner_id);
      CREATE TABLE ownership_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collectible_id TEXT NOT NULL REFERENCES collectibles(id),
        from_account TEXT,
        to_account TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('discovered', 'unboxed', 'showroom', 'sale', 'scrapped', 'account_deleted')),
        price INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX ownership_collectible ON ownership_events(collectible_id, id);

      CREATE TABLE crate_openings (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        crate_id TEXT NOT NULL,
        price INTEGER NOT NULL,
        collectible_id TEXT NOT NULL REFERENCES collectibles(id),
        rarity TEXT NOT NULL,
        pity_applied INTEGER NOT NULL CHECK (pity_applied IN (0, 1)),
        seen INTEGER NOT NULL DEFAULT 0 CHECK (seen IN (0, 1)),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX crate_openings_account ON crate_openings(account_id, crate_id, created_at);

      CREATE TABLE listings (
        id TEXT PRIMARY KEY,
        collectible_id TEXT NOT NULL REFERENCES collectibles(id),
        seller_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        rarity TEXT NOT NULL,
        price INTEGER NOT NULL CHECK (price > 0),
        status TEXT NOT NULL CHECK (status IN ('active', 'sold', 'cancelled')),
        buyer_id TEXT,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      );
      CREATE UNIQUE INDEX listings_one_active ON listings(collectible_id) WHERE status = 'active';
      CREATE INDEX listings_search ON listings(status, vehicle_id, price);
      CREATE TABLE sales (
        listing_id TEXT PRIMARY KEY REFERENCES listings(id),
        collectible_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        price INTEGER NOT NULL,
        fee INTEGER NOT NULL CHECK (fee >= 0),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX sales_vehicle ON sales(vehicle_id, created_at);
      CREATE TABLE wishlist (account_id TEXT NOT NULL, vehicle_id TEXT NOT NULL, PRIMARY KEY (account_id, vehicle_id));
      CREATE TABLE watchlist (account_id TEXT NOT NULL, listing_id TEXT NOT NULL, PRIMARY KEY (account_id, listing_id));

      CREATE TABLE idempotency (
        account_id TEXT NOT NULL,
        key TEXT NOT NULL,
        op TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, key)
      );
      CREATE TABLE audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT,
        action TEXT NOT NULL,
        ref TEXT,
        detail_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
    `,
    down: `
      DROP TABLE audit_events; DROP TABLE idempotency; DROP TABLE watchlist; DROP TABLE wishlist;
      DROP TABLE sales; DROP TABLE listings; DROP TABLE crate_openings; DROP TABLE ownership_events;
      DROP TABLE collectibles; DROP TABLE discoveries; DROP TABLE recognitions; DROP TABLE ledger;
      DROP TABLE wallets; DROP TABLE tokens; DROP TABLE accounts;
    `,
  },
  {
    version: 2,
    name: 'achievements, seasons, cosmetics, entitlements, safety',
    up: `
      CREATE TABLE achievement_claims (
        account_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, achievement_id)
      );
      CREATE TABLE season_progress (
        account_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
        PRIMARY KEY (account_id, season_id)
      );
      CREATE TABLE season_claims (
        account_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        tier INTEGER NOT NULL,
        track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, season_id, tier, track)
      );
      CREATE TABLE owned_cosmetics (
        account_id TEXT NOT NULL,
        cosmetic_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('default', 'purchase', 'season')),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, cosmetic_id)
      );
      CREATE TABLE entitlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('apple', 'google')),
        environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
        product_id TEXT NOT NULL,
        original_transaction_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('active', 'grace', 'on_hold', 'expired', 'revoked', 'refunded')),
        expires_at INTEGER,
        updated_at INTEGER NOT NULL,
        UNIQUE (platform, original_transaction_id)
      );
      CREATE INDEX entitlements_account ON entitlements(account_id);
      CREATE TABLE blocks (account_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (account_id, blocked_id));
      CREATE TABLE reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL,
        target_account TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('offensive_name', 'harassment', 'cheating', 'other')),
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
    `,
    down: `
      DROP TABLE reports; DROP TABLE blocks; DROP TABLE entitlements; DROP TABLE owned_cosmetics;
      DROP TABLE season_claims; DROP TABLE season_progress; DROP TABLE achievement_claims;
    `,
  },
];

export function openEconomyDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);
  `);
  return db;
}

/** Applies pending migrations, each in its own transaction. Returns the versions applied. */
export function migrate(db: DatabaseSync, now = Date.now(), migrations = MIGRATIONS): number[] {
  const applied = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  const done: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(m.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(m.up);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, now);
      db.exec('COMMIT');
      done.push(m.version);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return done;
}

/** Reverts migrations above `target`, newest first. For restored backup copies only; see docs/BACKEND.md. */
export function rollback(db: DatabaseSync, target: number, migrations = MIGRATIONS): number[] {
  const applied = (db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC').all() as { version: number }[]).map(
    (r) => r.version,
  );
  const undone: number[] = [];
  for (const v of applied) {
    if (v <= target) break;
    const m = migrations.find((x) => x.version === v);
    if (!m) throw new Error(`No migration ${v} to roll back`);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(m.down);
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(v);
      db.exec('COMMIT');
      undone.push(v);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return undone;
}
