import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppServices } from '@english-ai/core';
import { createEmailService, type EmailService } from '../email/emailService';
import { DisabledMailer } from '../email/mailers';
import type { Logger } from '../logger';
import type { SessionTokens } from '../security/sessionTokens';
import { errorHandler, notFound } from './middleware/errors';
import { authenticate, createRateLimiters, CSRF_HEADER, requireCsrfHeader, SESSION_USER_HEADER, type RateLimitOptions } from './middleware/security';
import { authRoutes } from './routes/authRoutes';
import { conversationRoutes } from './routes/conversationRoutes';
import { learningRoutes } from './routes/learningRoutes';
import { passwordRoutes } from './routes/passwordRoutes';

export interface AppOptions {
  services: AppServices;
  tokens: SessionTokens;
  logger: Logger;
  corsOrigin: string;
  secureCookies: boolean;
  aiProvider: string;
  rateLimits?: RateLimitOptions;
  /** Pasta com o build do front-end para servir na mesma origem (opcional). */
  webDistPath?: string;
  /** Envio de e-mails (boas-vindas, recuperação de senha). Sem ele, nenhum e-mail é enviado. */
  email?: EmailService;
}

export function createApp(options: AppOptions): Express {
  const { services, tokens, logger } = options;
  const app = express();
  const limiters = createRateLimiters(options.rateLimits);
  const email =
    options.email ?? createEmailService({ mailer: new DisabledMailer(), logger, appUrl: options.corsOrigin.split(',')[0]?.trim() ?? '' });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    '/api',
    cors({
      origin: options.corsOrigin.split(',').map((origin) => origin.trim()),
      credentials: true,
      allowedHeaders: ['Content-Type', CSRF_HEADER, SESSION_USER_HEADER],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use('/api', limiters.global);
  app.use('/api', express.json({ limit: '16kb' }));
  app.use('/api', cookieParser());
  app.use('/api', (req, res, next) => {
    const started = performance.now();
    res.on('finish', () => {
      logger.info('http.request', {
        method: req.method,
        route: req.route?.path ?? req.path.replace(/[0-9a-f-]{16,}/gi, ':id'),
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
        userId: res.locals.userId,
      });
    });
    next();
  });
  app.use('/api', requireCsrfHeader);
  app.use('/api', authenticate(tokens, (userId) => services.auth.sessionVersion(userId)));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', aiProvider: options.aiProvider });
  });
  app.use('/api', authRoutes({ services, tokens, email, secureCookies: options.secureCookies, authLimiter: limiters.auth }));
  app.use(
    '/api',
    passwordRoutes({
      services,
      email,
      secureCookies: options.secureCookies,
      requestLimiter: limiters.passwordReset,
      authLimiter: limiters.auth,
    }),
  );
  app.use('/api', conversationRoutes({ services, aiLimiter: limiters.ai }));
  app.use('/api', learningRoutes({ services, aiLimiter: limiters.ai }));
  app.use('/api', notFound);

  // Opcional: servir o front-end compilado na mesma origem (deploy único).
  const dist = options.webDistPath ? resolve(options.webDistPath) : null;
  if (dist && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    // `root` limita a checagem de arquivos ocultos ao nome do arquivo (a pasta do build pode estar em um caminho com ".").
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile('index.html', { root: dist }));
  }

  app.use(errorHandler(logger));
  return app;
}
