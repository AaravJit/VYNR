/**
 * node:sqlite adapter used by integration tests (Node >= 22.5). Never bundled
 * into the app: only imported from __tests__.
 */
import type { SqlDriver, SqlValue } from '@/db/driver';

interface NodeStatement {
  run(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
}
interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}

export class NodeSqlDriver implements SqlDriver {
  private constructor(private readonly db: NodeDatabase) {}

  static open(path = ':memory:'): NodeSqlDriver {
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => NodeDatabase };
    return new NodeSqlDriver(new DatabaseSync(path));
  }

  async exec(sql: string) {
    this.db.exec(sql);
  }
  async run(sql: string, params: SqlValue[] = []) {
    this.db.prepare(sql).run(...params);
  }
  async all<T>(sql: string, params: SqlValue[] = []) {
    return this.db.prepare(sql).all(...params).map((r) => ({ ...(r as object) }) as T);
  }
  async first<T>(sql: string, params: SqlValue[] = []) {
    const r = this.db.prepare(sql).get(...params);
    return r === undefined ? null : ({ ...(r as object) } as T);
  }
  async transaction(task: (tx: SqlDriver) => Promise<void>) {
    this.db.exec('BEGIN');
    try {
      await task(this);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
