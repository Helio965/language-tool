/**
 * Recuperação de senha (UC02, fluxo "Esqueci minha senha"). Ver docs/EMAIL-AND-AUTH.md.
 *
 * 1. POST /auth/password-reset          → resposta sempre igual; se a conta existir, envia o link por e-mail.
 * 2. POST /auth/password-reset/verify   → situação do link (válido, inválido, vencido ou já usado).
 * 3. POST /auth/password-reset/confirm  → senha nova; o link é consumido e as sessões abertas encerradas.
 *
 * O token viaja no corpo (POST), não na query string: não aparece em logs de acesso da API.
 */
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { PASSWORD_RESET_REQUESTED_MESSAGE, type AppServices } from '@english-ai/core';
import type { EmailService } from '../../email/emailService';
import { SESSION_COOKIE } from '../middleware/security';
import { sessionCookieOptions } from './authRoutes';

const requestSchema = z.object({ email: z.string().max(320) });
const verifySchema = z.object({ token: z.string().max(128) });
const confirmSchema = z.object({
  token: z.string().max(128),
  password: z.string().max(256),
  passwordConfirmation: z.string().max(256),
});

export function passwordRoutes(deps: {
  services: AppServices;
  email: EmailService;
  secureCookies: boolean;
  requestLimiter: RequestHandler;
  authLimiter: RequestHandler;
}): Router {
  const { services, email, requestLimiter, authLimiter } = deps;
  const cookieOptions = sessionCookieOptions(deps.secureCookies);
  const router = Router();

  router.post('/auth/password-reset', requestLimiter, async (req, res) => {
    const request = await services.passwordReset.requestReset(requestSchema.parse(req.body).email);
    // Envio em segundo plano: o tempo de resposta não depende de a conta existir.
    if (request) email.sendPasswordReset(request.user, request.token, request.expiresInMinutes);
    res.status(202).json({ message: PASSWORD_RESET_REQUESTED_MESSAGE, expiresInMinutes: services.passwordReset.ttlMinutes });
  });

  router.post('/auth/password-reset/verify', authLimiter, async (req, res) => {
    res.json({ status: await services.passwordReset.checkToken(verifySchema.parse(req.body).token) });
  });

  router.post('/auth/password-reset/confirm', authLimiter, async (req, res) => {
    const { userId } = await services.passwordReset.resetPassword(confirmSchema.parse(req.body));
    // Se este navegador estava conectado à mesma conta, a sessão dele também acabou (a versão subiu).
    const sessionEnded = res.locals.userId === userId;
    if (sessionEnded) res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.json({ message: 'Senha redefinida com sucesso.', sessionEnded });
  });

  return router;
}
