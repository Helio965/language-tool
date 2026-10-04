import { loadConfig } from './config/env';
import { createRuntime } from './composition';
import { createApp } from './http/app';
import { createLogger } from './logger';
import { SessionTokens } from './security/sessionTokens';

const RETENTION_SWEEP_MS = 6 * 60 * 60 * 1000;

async function main() {
  const logger = createLogger();
  const config = loadConfig();
  for (const warning of config.warnings) logger.warn('config.warning', { warning });

  const runtime = createRuntime(config, logger);
  const app = createApp({
    services: runtime.services,
    tokens: new SessionTokens(config.AUTH_TOKEN_SECRET, config.AUTH_TOKEN_TTL_HOURS),
    logger,
    corsOrigin: config.CORS_ORIGIN,
    secureCookies: config.isProduction,
    aiProvider: runtime.aiProvider,
    email: runtime.email,
    ...(config.WEB_DIST_PATH ? { webDistPath: config.WEB_DIST_PATH } : {}),
  });

  // Política de retenção: apaga periodicamente o conteúdo de conversas expiradas (RN07)
  // e os pedidos de redefinição de senha vencidos (minimização de dados).
  const sweep = async () => {
    try {
      const purged = await runtime.services.conversation.purgeExpired();
      if (purged) logger.info('retention.purged', { conversations: purged });
      const resets = await runtime.services.passwordReset.purgeExpired();
      if (resets) logger.info('retention.purged', { passwordResets: resets });
    } catch (error) {
      logger.error('retention.failed', { name: error instanceof Error ? error.name : 'unknown' });
    }
  };
  await sweep();
  const timer = setInterval(sweep, RETENTION_SWEEP_MS);
  timer.unref();

  const server = app.listen(config.API_PORT, () => {
    logger.info('server.started', { port: config.API_PORT, aiProvider: runtime.aiProvider, mail: runtime.email.transport, env: config.NODE_ENV });
  });

  const shutdown = (signal: string) => {
    logger.info('server.stopping', { signal });
    clearInterval(timer);
    server.close(() => {
      // Termina os envios de e-mail em andamento antes de fechar o banco.
      void runtime.email.idle().finally(() => {
        runtime.db.close();
        process.exit(0);
      });
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ level: 'error', event: 'server.failed', message: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
