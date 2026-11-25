import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Durable counters for rate limits, the daily request budget and daily spend.
 * Counters are keyed by (key, window) where window identifies a fixed time
 * window, for example a minute start or a UTC date.
 */
export interface CounterStore {
  get(key: string, window: string): number;
  add(key: string, window: string, amount: number): number;
  /** Drops every counter whose window is not in `keep` for the given key prefix. */
  prune(prefix: string, keep: string): void;
  close(): void;
}

export class MemoryCounterStore implements CounterStore {
  private readonly map = new Map<string, { window: string; value: number }>();

  get(key: string, window: string): number {
    const e = this.map.get(key);
    return e && e.window === window ? e.value : 0;
  }

  add(key: string, window: string, amount: number): number {
    const value = this.get(key, window) + amount;
    this.map.set(key, { window, value });
    return value;
  }

  prune(prefix: string, keep: string): void {
    for (const [k, e] of this.map) if (k.startsWith(prefix) && e.window !== keep) this.map.delete(k);
  }

  close(): void {}
}

/**
 * SQLite-backed counters (Node's built-in node:sqlite), so limits, the budget
 * and the spend ceiling survive restarts. One file per instance: several
 * replicas need a shared store such as Redis instead.
 */
export class SqliteCounterStore implements CounterStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS counters (
        key TEXT NOT NULL,
        window TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (key, window)
      ) WITHOUT ROWID;
    `);
  }

  get(key: string, window: string): number {
    const row = this.db.prepare('SELECT value FROM counters WHERE key = ? AND window = ?').get(key, window) as
      | { value: number }
      | undefined;
    return row?.value ?? 0;
  }

  add(key: string, window: string, amount: number): number {
    const row = this.db
      .prepare(
        `INSERT INTO counters (key, window, value) VALUES (?, ?, ?)
         ON CONFLICT (key, window) DO UPDATE SET value = value + excluded.value
         RETURNING value`,
      )
      .get(key, window, amount) as { value: number };
    return row.value;
  }

  prune(prefix: string, keep: string): void {
    this.db.prepare("DELETE FROM counters WHERE key LIKE ? ESCAPE '\\' AND window <> ?").run(`${prefix.replace(/[\\%_]/g, '\\$&')}%`, keep);
  }

  close(): void {
    this.db.close();
  }
}
