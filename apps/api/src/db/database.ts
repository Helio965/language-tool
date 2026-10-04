import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Abre o banco, aplica o esquema (idempotente) e ativa as chaves estrangeiras. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  // Em desenvolvimento o arquivo está ao lado deste módulo; no build, ao lado de dist/server.js.
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  migrate(db);
  return db;
}

/**
 * Migrações aditivas e idempotentes para bancos criados por versões anteriores.
 * Nunca apagam dados: só acrescentam o que o esquema atual espera e ainda não existe.
 */
function migrate(db: DatabaseSync): void {
  const userColumns = new Set((db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((column) => column.name));
  if (!userColumns.has('session_version')) {
    db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
  }
}

export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
