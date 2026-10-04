import type { DatabaseSync } from 'node:sqlite';
import { createAppServices, createStaticCatalog, type AppServices } from '@english-ai/core';
import { createAIService } from './ai/createAIService';
import type { AppConfig } from './config/env';
import { openDatabase } from './db/database';
import { createMailer } from './email/createMailer';
import { createEmailService, type EmailService } from './email/emailService';
import type { Mailer } from './email/types';
import { seedContent } from './db/seed';
import type { Logger } from './logger';
import { createSqliteStore } from './repositories/sqliteStore';
import { ScryptPasswordHasher } from './security/passwordHasher';

export interface Runtime {
  db: DatabaseSync;
  services: AppServices;
  aiProvider: string;
  email: EmailService;
}

/** Monta banco, conteúdo, IA, e-mail e casos de uso a partir da configuração. */
export function createRuntime(
  config: AppConfig,
  logger: Logger,
  options: { databasePath?: string; mailer?: Mailer } = {},
): Runtime {
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
    passwordResetTtlMinutes: config.PASSWORD_RESET_TTL_MINUTES,
  });
  const email = createEmailService({ mailer: options.mailer ?? createMailer(config.mail, logger), logger, appUrl: config.mail.appUrl });
  return { db, services, aiProvider: ai.providerName, email };
}
