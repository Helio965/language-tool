/**
 * Recuperação de senha (UC02 — fluxo alternativo "Esqueci minha senha").
 *
 * - O link leva um token aleatório de 256 bits; o banco guarda só o hash SHA-256.
 * - Validade curta (padrão: 15 minutos) e uso único.
 * - Um novo pedido invalida os links anteriores da conta.
 * - Pedidos repetidos em menos de 1 minuto não geram outro e-mail.
 * - Quem chama nunca revela ao visitante se o e-mail tem conta (a resposta é sempre a mesma).
 * - Trocar a senha encerra as sessões abertas da conta (UserRepository.updatePassword).
 *
 * O envio do e-mail fica fora do core: a API usa SMTP; o modo demonstração mostra uma simulação.
 */
import type { User } from '../../domain/entities';
import { AppError } from '../../domain/errors';
import { assertValid, normalizeEmail, validateEmail, validateNewPassword, type NewPasswordInput } from '../../domain/validation';
import { publicUser, type ServiceContext } from '../context';
import { generateSecureToken, hashToken, isWellFormedToken } from '../secureToken';

/** Resposta única do pedido, exista a conta ou não (anti-enumeração). */
export const PASSWORD_RESET_REQUESTED_MESSAGE = 'Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.';

/** Intervalo mínimo entre dois e-mails de recuperação para a mesma conta. */
export const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

export type ResetTokenStatus = 'valid' | 'invalid' | 'expired' | 'used';

export interface PasswordResetRequest {
  user: User;
  /** Token em texto puro: vai apenas no link do e-mail, nunca para o banco ou para os logs. */
  token: string;
  expiresAt: string;
  expiresInMinutes: number;
}

export interface ResetPasswordInput extends NewPasswordInput {
  token: string;
}

export function createPasswordResetService(ctx: ServiceContext) {
  const resets = ctx.store.passwordResets;

  async function inspect(token: string) {
    if (!isWellFormedToken(token)) return { status: 'invalid' as const, record: null };
    const record = await resets.findByTokenHash(await hashToken(token));
    if (!record || !(await ctx.store.users.findById(record.userId))) return { status: 'invalid' as const, record: null };
    if (record.usedAt) return { status: 'used' as const, record };
    if (ctx.now().getTime() >= Date.parse(record.expiresAt)) return { status: 'expired' as const, record };
    return { status: 'valid' as const, record };
  }

  return {
    /** Prazo de validade do link, em minutos (informado ao visitante sem revelar nada sobre a conta). */
    ttlMinutes: ctx.resetTtlMinutes,

    /**
     * Cria um link de redefinição se o e-mail tiver conta. Retorna null quando não há o que enviar
     * (conta inexistente ou pedido repetido logo em seguida) — quem chama responde igual nos dois casos.
     */
    async requestReset(email: string): Promise<PasswordResetRequest | null> {
      const emailError = validateEmail(email);
      assertValid(emailError ? { email: emailError } : {});
      const user = await ctx.store.users.findByEmail(normalizeEmail(email));
      if (!user) return null;

      const now = ctx.now();
      const latest = await resets.latestForUser(user.id);
      const recent =
        latest &&
        !latest.usedAt &&
        now.getTime() - Date.parse(latest.createdAt) < PASSWORD_RESET_COOLDOWN_SECONDS * 1000 &&
        now.getTime() < Date.parse(latest.expiresAt);
      if (recent) return null;

      // Um link ativo por conta: os anteriores (e os vencidos) deixam de existir.
      await resets.deleteForUser(user.id);
      const token = generateSecureToken();
      const expiresAt = new Date(now.getTime() + ctx.resetTtlMinutes * 60_000).toISOString();
      await resets.create({
        id: ctx.id(),
        userId: user.id,
        tokenHash: await hashToken(token),
        createdAt: now.toISOString(),
        expiresAt,
        usedAt: null,
      });
      return { user: publicUser(user), token, expiresAt, expiresInMinutes: ctx.resetTtlMinutes };
    },

    /** Situação do link, para a tela mostrar o estado certo antes de pedir a senha nova. */
    async checkToken(token: string): Promise<ResetTokenStatus> {
      return (await inspect(token)).status;
    },

    /** Define a senha nova (mesma política do cadastro), consome o link e encerra as sessões abertas. */
    async resetPassword(input: ResetPasswordInput): Promise<{ userId: string }> {
      const { status, record } = await inspect(input.token);
      if (status !== 'valid' || !record) throw new AppError('RESET_TOKEN_INVALID', 'Link de redefinição inválido.');
      assertValid(validateNewPassword(input));
      const passwordHash = await ctx.hasher.hash(input.password);
      // Marcação atômica: se dois envios usarem o mesmo link ao mesmo tempo, só um troca a senha.
      if (!(await resets.markUsed(record.id, ctx.now().toISOString()))) {
        throw new AppError('RESET_TOKEN_INVALID', 'Link de redefinição já utilizado.');
      }
      await ctx.store.users.updatePassword(record.userId, passwordHash);
      return { userId: record.userId };
    },

    /** Minimização de dados: pedidos vencidos há mais de um dia não servem para mais nada. */
    async purgeExpired(): Promise<number> {
      return resets.deleteExpired(new Date(ctx.now().getTime() - 86_400_000).toISOString());
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
