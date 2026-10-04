import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/database';
import { createSqliteStore } from '../src/repositories/sqliteStore';

const USER = {
  id: 'u-1',
  name: 'Ana',
  email: 'ana@example.com',
  passwordHash: 'hash-antigo',
  role: 'user' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  termsAcceptedAt: '2026-01-01T00:00:00.000Z',
};

const TOKEN = {
  id: 't-1',
  userId: USER.id,
  tokenHash: 'a'.repeat(64),
  createdAt: '2026-01-01T10:00:00.000Z',
  expiresAt: '2026-01-01T10:15:00.000Z',
  usedAt: null,
};

describe('banco SQLite — redefinição de senha', () => {
  it('migra um banco antigo (sem session_version) sem perder dados', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'english-ai-migration-')), 'old.db');
    // Banco criado por uma versão anterior: tabela users sem a coluna nova.
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, terms_accepted_at TEXT NOT NULL)`);
    old.prepare(`INSERT INTO users VALUES ('u-1', 'Ana', 'ana@example.com', 'hash-antigo', 'user', '2026-01-01', '2026-01-01')`).run();
    old.close();

    const db = openDatabase(path);
    const store = createSqliteStore(db);
    expect(await store.users.findById('u-1')).toMatchObject({ email: 'ana@example.com', passwordHash: 'hash-antigo', sessionVersion: 0 });
    // Abrir de novo não tenta recriar a coluna (idempotente).
    db.close();
    const again = openDatabase(path);
    expect(await createSqliteStore(again).users.findById('u-1')).toMatchObject({ sessionVersion: 0 });
    again.close();
  });

  it('troca a senha incrementando a versão da sessão', async () => {
    const store = createSqliteStore(openDatabase(':memory:'));
    await store.users.create(USER);
    await store.users.updatePassword(USER.id, 'hash-novo');
    expect(await store.users.findById(USER.id)).toMatchObject({ passwordHash: 'hash-novo', sessionVersion: 1 });
  });

  it('marca o link como usado uma única vez e remove os pedidos da conta', async () => {
    const store = createSqliteStore(openDatabase(':memory:'));
    await store.users.create(USER);
    await store.passwordResets.create(TOKEN);
    expect(await store.passwordResets.findByTokenHash(TOKEN.tokenHash)).toEqual(TOKEN);
    expect(await store.passwordResets.markUsed(TOKEN.id, '2026-01-01T10:05:00.000Z')).toBe(true);
    expect(await store.passwordResets.markUsed(TOKEN.id, '2026-01-01T10:06:00.000Z')).toBe(false);
    expect(await store.passwordResets.latestForUser(USER.id)).toMatchObject({ usedAt: '2026-01-01T10:05:00.000Z' });
    await store.passwordResets.deleteForUser(USER.id);
    expect(await store.passwordResets.findByTokenHash(TOKEN.tokenHash)).toBeNull();
  });

  it('remove pedidos vencidos e os de contas excluídas', async () => {
    const store = createSqliteStore(openDatabase(':memory:'));
    await store.users.create(USER);
    await store.passwordResets.create(TOKEN);
    expect(await store.passwordResets.deleteExpired('2026-01-01T10:00:00.000Z')).toBe(0);
    expect(await store.passwordResets.deleteExpired('2026-01-02T00:00:00.000Z')).toBe(1);

    await store.passwordResets.create({ ...TOKEN, id: 't-2', tokenHash: 'b'.repeat(64) });
    await store.deleteUserData(USER.id);
    expect(await store.passwordResets.latestForUser(USER.id)).toBeNull();
  });
});
