import { DatabaseSync } from 'node:sqlite';

/**
 * Persistent, atomic counters for rate limits, the global request and spend
 * ceilings, and the recognition result cache.
 *
 * Backed by SQLite (node:sqlite, no extra dependency). Every check-and-update
 * runs inside `BEGIN IMMEDIATE`, which takes the database write lock first, so
 * concurrent requests (and several server processes sharing the same file on
 * one host) can never both pass a limit that only has room for one. Counters
 * survive restarts. Replicas on different hosts need a shared store instead;
 * see docs/DEPLOYMENT.md.
 */
export interface SpendLimits {
  dailyRequests: number;
  dailySpendMicros: number;
  monthlySpendMicros: number;
}

export type ReserveOutcome = { ok: true; day: string } | { ok: false; reason: 'requests' | 'daily_spend' | 'monthly_spend' };

export class QuotaStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS windows (key TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS spend (
        day TEXT PRIMARY KEY,
        requests INTEGER NOT NULL DEFAULT 0,
        reserved_micros INTEGER NOT NULL DEFAULT 0,
        spent_micros INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS results (hash TEXT PRIMARY KEY, json TEXT NOT NULL, expires INTEGER NOT NULL);
    `);
  }

  private atomic<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Fixed-window limiter. Returns 0 when allowed (and counts the hit), otherwise seconds until retry. */
  hit(key: string, limit: number, windowMs: number, now: number): number {
    const start = Math.floor(now / windowMs) * windowMs;
    return this.atomic(() => {
      const row = this.db.prepare('SELECT start, count FROM windows WHERE key = ?').get(key) as
        | { start: number; count: number }
        | undefined;
      const count = row && row.start === start ? row.count : 0;
      if (count >= limit) return Math.max(1, Math.ceil((start + windowMs - now) / 1000));
      this.db
        .prepare('INSERT INTO windows (key, start, count) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET start = excluded.start, count = excluded.count')
        .run(key, start, count + 1);
      return 0;
    });
  }

  /**
   * Reserves the worst-case cost of one recognition before calling the model.
   * The reservation counts against the daily and monthly ceilings until it is
   * settled with the real cost, so concurrent calls cannot overshoot.
   */
  reserve(now: number, worstCaseMicros: number, limits: SpendLimits): ReserveOutcome {
    const day = utcDay(now);
    const month = day.slice(0, 7);
    return this.atomic(() => {
      const today = (this.db.prepare('SELECT requests, reserved_micros, spent_micros FROM spend WHERE day = ?').get(day) as
        | { requests: number; reserved_micros: number; spent_micros: number }
        | undefined) ?? { requests: 0, reserved_micros: 0, spent_micros: 0 };
      if (today.requests >= limits.dailyRequests) return { ok: false, reason: 'requests' } as const;
      if (today.spent_micros + today.reserved_micros + worstCaseMicros > limits.dailySpendMicros) {
        return { ok: false, reason: 'daily_spend' } as const;
      }
      const m = this.db
        .prepare('SELECT COALESCE(SUM(spent_micros + reserved_micros), 0) AS total FROM spend WHERE day LIKE ?')
        .get(`${month}-%`) as { total: number };
      if (m.total + worstCaseMicros > limits.monthlySpendMicros) return { ok: false, reason: 'monthly_spend' } as const;
      this.db
        .prepare(
          `INSERT INTO spend (day, requests, reserved_micros) VALUES (?, 1, ?)
           ON CONFLICT(day) DO UPDATE SET requests = requests + 1, reserved_micros = reserved_micros + excluded.reserved_micros`,
        )
        .run(day, worstCaseMicros);
      return { ok: true, day } as const;
    });
  }

  /** Replaces a reservation with the actual cost (which may be 0 if the call failed before billing). */
  settle(day: string, reservedMicros: number, actualMicros: number): void {
    this.atomic(() => {
      this.db
        .prepare('UPDATE spend SET reserved_micros = MAX(0, reserved_micros - ?), spent_micros = spent_micros + ? WHERE day = ?')
        .run(reservedMicros, actualMicros, day);
    });
  }

  usage(now: number): { day: string; requests: number; spentMicros: number; reservedMicros: number; monthSpentMicros: number } {
    const day = utcDay(now);
    const today = (this.db.prepare('SELECT requests, reserved_micros, spent_micros FROM spend WHERE day = ?').get(day) as
      | { requests: number; reserved_micros: number; spent_micros: number }
      | undefined) ?? { requests: 0, reserved_micros: 0, spent_micros: 0 };
    const m = this.db
      .prepare('SELECT COALESCE(SUM(spent_micros), 0) AS total FROM spend WHERE day LIKE ?')
      .get(`${day.slice(0, 7)}-%`) as { total: number };
    return { day, requests: today.requests, spentMicros: today.spent_micros, reservedMicros: today.reserved_micros, monthSpentMicros: m.total };
  }

  getCached(hash: string, now: number): string | null {
    const row = this.db.prepare('SELECT json, expires FROM results WHERE hash = ?').get(hash) as
      | { json: string; expires: number }
      | undefined;
    return row && row.expires > now ? row.json : null;
  }

  putCached(hash: string, json: string, expires: number): void {
    this.db
      .prepare('INSERT INTO results (hash, json, expires) VALUES (?, ?, ?) ON CONFLICT(hash) DO UPDATE SET json = excluded.json, expires = excluded.expires')
      .run(hash, json, expires);
  }

  /** Drops expired windows and cache entries so storage stays bounded. Spend rows are kept for 400 days. */
  sweep(now: number, longestWindowMs: number): void {
    this.db.prepare('DELETE FROM windows WHERE start < ?').run(now - longestWindowMs);
    this.db.prepare('DELETE FROM results WHERE expires <= ?').run(now);
    this.db.prepare('DELETE FROM spend WHERE day < ?').run(utcDay(now - 400 * 86_400_000));
  }

  close(): void {
    this.db.close();
  }
}

export function utcDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
