/**
 * Minimal async SQL driver interface. The app uses an expo-sqlite adapter; tests
 * use a node:sqlite adapter with the exact same schema and migrations.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /**
   * Runs `task` atomically; rolls back on throw. All statements inside the task
   * must go through the provided `tx` handle.
   */
  transaction(task: (tx: SqlDriver) => Promise<void>): Promise<void>;
}
