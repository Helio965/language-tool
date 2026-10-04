import type { DatabaseSync } from 'node:sqlite';
import { createAppServices, createStaticCatalog, type AppServices } from '@english-ai/core';
import { createAIService } from './ai/createAIService';
import type { AppConfig } from './config/env';
import { openDatabase } from './db/database';
import { seedContent } from './db/seed';
import type { Logger } from './logger';
import { createSqliteStore } from './repositories/sqliteStore';
import { ScryptPasswordHasher } from './security/passwordHasher';

export interface Runtime {
  db: DatabaseSync;
  services: AppServices;
  aiProvider: string;
}

/** Monta banco, conteúdo, IA e casos de uso a partir da configuração. */
export function createRuntime(config: AppConfig, logger: Logger, options: { databasePath?: string } = {}): Runtime {
  const catalog = createStaticCatalog();
  const db = openDatabase(options.databasePath ?? config.DATABASE_PATH);
  seedContent(db, catalog);
  const ai = createAIService(config, catalog, logger);
  const services = createAppServices({
    store: createSqliteStore(db),
    catalog,
    ai,
    passwordHasher: new ScryptPasswordHasher(),
    conversationRetentionDays: config.CONVERSATION_RETENTION_DAYS,
    maxHistoryMessages: config.AI_MAX_HISTORY_MESSAGES,
  });
  return { db, services, aiProvider: ai.providerName };
}
