/**
 * UC01 (Criar conta), UC02 (Fazer login), UC03 (Configurar perfil), UC12 (Preferências), RF20 (Exclusão de dados).
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { AppError, GOALS, INTEREST_AREAS, PRIOR_EXPERIENCES, type AccountState, type AppServices } from '@english-ai/core';
import type { SessionTokens } from '../../security/sessionTokens';
import { requireAuth, SESSION_COOKIE, userIdOf } from '../middleware/security';
import type { RequestHandler } from 'express';

const text = (max: number) => z.string().max(max);

const registerSchema = z.object({
  name: text(200),
  email: text(320),
  password: text(256),
  passwordConfirmation: text(256),
  acceptedTerms: z.boolean(),
});
const loginSchema = z.object({ email: text(320), password: text(256) });
const resetSchema = z.object({ email: text(320) });
const deleteSchema = z.object({ password: text(256) });
const profileSchema = z.object({
  goal: z.enum(GOALS),
  perceivedLevel: z.enum(['unknown', 'beginner', 'basic', 'intermediate', 'advanced']),
  priorExperience: z.enum(PRIOR_EXPERIENCES),
  conversationInterest: z.boolean(),
  professionalInterest: z.boolean(),
  interestAreas: z.array(z.enum(INTEREST_AREAS)).max(8),
});
const preferencesSchema = z
  .object({
    explanationLanguage: z.enum(['auto', 'pt', 'en']),
    correctionIntensity: z.enum(['light', 'balanced', 'detailed']),
    replyLength: z.enum(['short', 'balanced']),
    showTranslations: z.boolean(),
    saveConversationHistory: z.boolean(),
    studyReminders: z.boolean(),
    dailyGoalMinutes: z.number().int(),
  })
  .partial();

export function authRoutes(deps: {
  services: AppServices;
  tokens: SessionTokens;
  secureCookies: boolean;
  authLimiter: RequestHandler;
}): Router {
  const { services, tokens, secureCookies, authLimiter } = deps;
  const router = Router();
  const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: secureCookies, path: '/api' };

  const startSession = (res: Response, account: AccountState) => {
    res.cookie(SESSION_COOKIE, tokens.issue(account.user.id), { ...cookieOptions, maxAge: tokens.maxAgeMs });
    return account;
  };

  router.post('/auth/register', authLimiter, async (req, res) => {
    const account = await services.auth.register(registerSchema.parse(req.body));
    res.status(201).json(startSession(res, account));
  });

  router.post('/auth/login', authLimiter, async (req, res) => {
    const account = await services.auth.login(loginSchema.parse(req.body));
    res.json(startSession(res, account));
  });

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  /**
   * Recuperação de senha: resposta sempre igual (não revela se o e-mail existe).
   * O MVP não possui serviço de e-mail configurado — ver docs/ARCHITECTURE.md §12.
   */
  router.post('/auth/password-reset', authLimiter, (req, res) => {
    resetSchema.parse(req.body);
    res.status(202).json({ message: 'Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.' });
  });

  /** Estado da sessão sem erro: 200 com a conta ou null (visitantes não geram 401 no console). */
  router.get('/auth/session', async (_req, res) => {
    const userId = res.locals.userId;
    if (typeof userId !== 'string') return void res.json({ account: null });
    try {
      res.json({ account: await services.auth.getAccount(userId) });
    } catch (error) {
      if (!(error instanceof AppError && error.code === 'UNAUTHENTICATED')) throw error;
      res.clearCookie(SESSION_COOKIE, cookieOptions);
      res.json({ account: null });
    }
  });

  router.get('/me', requireAuth, async (_req, res) => {
    res.json(await services.auth.getAccount(userIdOf(res)));
  });

  router.delete('/me', requireAuth, authLimiter, async (req, res) => {
    await services.auth.deleteAccount(userIdOf(res), deleteSchema.parse(req.body).password);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.put('/me/profile', requireAuth, async (req, res) => {
    res.json(await services.profile.saveProfile(userIdOf(res), profileSchema.parse(req.body)));
  });

  router.get('/me/preferences', requireAuth, async (_req, res) => {
    res.json(await services.profile.getPreferences(userIdOf(res)));
  });

  router.patch('/me/preferences', requireAuth, async (req, res) => {
    res.json(await services.profile.updatePreferences(userIdOf(res), preferencesSchema.parse(req.body)));
  });

  return router;
}
