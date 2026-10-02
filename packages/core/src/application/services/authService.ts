/**
 * UC01 — Criar conta · UC02 — Fazer login · RF20 — Exclusão de dados.
 */
import { AppError } from '../../domain/errors';
import {
  assertValid,
  normalizeEmail,
  validateLogin,
  validateRegistration,
  type LoginInput,
  type RegistrationInput,
} from '../../domain/validation';
import { accountState, defaultPreferences, defaultProfile, requireUser, type ServiceContext } from '../context';
import type { AccountState } from '../views';

/** Hash fictício usado para equalizar o tempo de resposta quando o e-mail não existe. */
let timingSafetyHash: Promise<string> | null = null;

export function createAuthService(ctx: ServiceContext) {
  const dummyHash = () => (timingSafetyHash ??= ctx.hasher.hash('timing-safety-placeholder-1'));

  return {
    async register(input: RegistrationInput): Promise<AccountState> {
      assertValid(validateRegistration(input));
      const email = normalizeEmail(input.email);
      if (await ctx.store.users.findByEmail(email)) {
        throw new AppError('EMAIL_IN_USE', 'Já existe uma conta com este e-mail.', {
          email: 'Já existe uma conta com este e-mail. Que tal entrar?',
        });
      }
      const now = ctx.now();
      const user = {
        id: ctx.id(),
        name: input.name.trim(),
        email,
        role: 'user' as const,
        createdAt: now.toISOString(),
        termsAcceptedAt: now.toISOString(),
        passwordHash: await ctx.hasher.hash(input.password),
      };
      await ctx.store.users.create(user);
      await ctx.store.profiles.save(defaultProfile(user.id, now));
      await ctx.store.preferences.save(defaultPreferences(user.id, now));
      return accountState(ctx, user);
    },

    async login(input: LoginInput): Promise<AccountState> {
      assertValid(validateLogin(input));
      const user = await ctx.store.users.findByEmail(normalizeEmail(input.email));
      if (!user) {
        await ctx.hasher.verify(input.password, await dummyHash());
        throw new AppError('INVALID_CREDENTIALS', 'Credenciais inválidas.');
      }
      if (!(await ctx.hasher.verify(input.password, user.passwordHash))) {
        throw new AppError('INVALID_CREDENTIALS', 'Credenciais inválidas.');
      }
      return accountState(ctx, user);
    },

    async getAccount(userId: string): Promise<AccountState> {
      return accountState(ctx, await requireUser(ctx, userId));
    },

    /** RF20: exclui conta e todos os dados associados após confirmar a senha. */
    async deleteAccount(userId: string, password: string): Promise<void> {
      const user = await requireUser(ctx, userId);
      if (!password || !(await ctx.hasher.verify(password, user.passwordHash))) {
        throw new AppError('VALIDATION', 'Senha incorreta.', { password: 'Senha incorreta.' });
      }
      await ctx.store.deleteUserData(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
