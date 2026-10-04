import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '@english-ai/core';
import type { SessionTokens } from '../../security/sessionTokens';

export const SESSION_COOKIE = 'ea_session';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'english-ai';

/** Lê o cookie de sessão e, se válido, guarda o id do usuário em res.locals. */
export function authenticate(tokens: SessionTokens) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const userId = typeof token === 'string' ? tokens.verify(token) : null;
    if (userId) res.locals.userId = userId;
    next();
  };
}

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.userId) return next(new AppError('UNAUTHENTICATED', 'Sessão inválida ou expirada.'));
  next();
}

export function userIdOf(res: Response): string {
  const userId = res.locals.userId;
  if (typeof userId !== 'string') throw new AppError('UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  return userId;
}

/**
 * Proteção CSRF: requisições que alteram dados precisam de um cabeçalho personalizado,
 * que formulários de outros sites não conseguem enviar (somado a SameSite=Strict e CORS restrito).
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (!safe && req.get(CSRF_HEADER) !== CSRF_VALUE) return next(new AppError('FORBIDDEN', 'Requisição não permitida.'));
  next();
}

export interface RateLimitOptions {
  /** Desativa os limites (apenas em testes automatizados). */
  disabled?: boolean;
}

const limitHandler = (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError('RATE_LIMITED', 'Muitas requisições.'));

export function createRateLimiters({ disabled }: RateLimitOptions = {}) {
  const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();
  if (disabled) return { global: passthrough, auth: passthrough, ai: passthrough };
  return {
    /** Limite geral por IP. */
    global: rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, handler: limitHandler }),
    /** Tentativas de login/cadastro/recuperação por IP (proteção contra força bruta e enumeração). */
    auth: rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: limitHandler }),
    /** Chamadas que podem acionar o modelo de IA, por usuário (controle de custo — Risco 1). */
    ai: rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (_req, res) => String(res.locals.userId ?? 'anonymous'),
      handler: limitHandler,
    }),
  };
}
