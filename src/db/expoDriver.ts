import * as SQLite from 'expo-sqlite';

import type { SqlDriver, SqlValue } from './driver';

/** Executes statements directly on the connection, with no queueing. */
class DirectExecutor implements SqlDriver {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}
  exec(sql: string) {
    return this.db.execAsync(sql);
  }
  async run(sql: string, params: SqlValue[] = []) {
    await this.db.runAsync(sql, params);
  }
  all<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getAllAsync<T>(sql, params);
  }
  first<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getFirstAsync<T>(sql, params);
  }
  transaction(task: (tx: SqlDriver) => Promise<void>): Promise<void> {
    // Already inside a transaction: run inline.
    return task(this);
  }
}

/**
 * expo-sqlite adapter. Every top-level operation is serialized through a
 * promise queue, so no statement from another caller can interleave with an
 * open transaction (expo-sqlite's withTransactionAsync is not exclusive).
 */
export class ExpoSqlDriver implements SqlDriver {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly direct: DirectExecutor;

  constructor(private readonly db: SQLite.SQLiteDatabase) {
    this.direct = new DirectExecutor(db);
  }

  static async open(name = 'vynr.db'): Promise<ExpoSqlDriver> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    return new ExpoSqlDriver(db);
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  exec(sql: string) {
    return this.serialize(() => this.direct.exec(sql));
  }
  run(sql: string, params: SqlValue[] = []) {
    return this.serialize(() => this.direct.run(sql, params));
  }
  all<T>(sql: string, params: SqlValue[] = []) {
    return this.serialize(() => this.direct.all<T>(sql, params));
  }
  first<T>(sql: string, params: SqlValue[] = []) {
    return this.serialize(() => this.direct.first<T>(sql, params));
  }
  transaction(task: (tx: SqlDriver) => Promise<void>): Promise<void> {
    return this.serialize(() => this.db.withTransactionAsync(() => task(this.direct)));
  }
}
