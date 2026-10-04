import { describe, expect, it } from 'vitest';
import {
  AppError,
  createDocumentStore,
  hashToken,
  MemoryStorage,
  PASSWORD_RESET_COOLDOWN_SECONDS,
  type PasswordResetRequest,
} from '../src';
import { createTestApp, VALID_REGISTRATION } from './helpers';

const NEW_PASSWORD = { password: 'novaSenha9', passwordConfirmation: 'novaSenha9' };

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === code);
}

async function setup() {
  const storage = new MemoryStorage();
  const app = createTestApp({ storage });
  await app.services.auth.register(VALID_REGISTRATION);
  const store = createDocumentStore(storage);
  return { ...app, storage, store };
}

async function request(app: Awaited<ReturnType<typeof setup>>): Promise<PasswordResetRequest> {
  const result = await app.services.passwordReset.requestReset(VALID_REGISTRATION.email);
  if (!result) throw new Error('esperava um pedido de redefinição');
  return result;
}

describe('recuperação de senha — pedido', () => {
  it('gera um link só quando a conta existe, com validade de 15 minutos', async () => {
    const app = await setup();
    expect(await app.services.passwordReset.requestReset('ninguem@example.com')).toBeNull();

    const result = await request(app);
    expect(result.user).toMatchObject({ email: VALID_REGISTRATION.email, name: 'Alex Souza' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('sessionVersion');
    expect(result.expiresInMinutes).toBe(15);
    expect(Date.parse(result.expiresAt) - app.clock.now.getTime()).toBe(15 * 60_000);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('aceita o e-mail com maiúsculas e espaços, como no login', async () => {
    const app = await setup();
    expect(await app.services.passwordReset.requestReset('  ALEX@example.com ')).not.toBeNull();
  });

  it('recusa e-mail mal formatado com erro de validação (não revela nada sobre contas)', async () => {
    const app = await setup();
    await expectAppError(app.services.passwordReset.requestReset('sem-arroba'), 'VALIDATION');
  });

  it('guarda apenas o hash SHA-256 do token, nunca o token', async () => {
    const app = await setup();
    const { token } = await request(app);
    const raw = app.storage.getItem('english-ai:v1:passwordResets') ?? '';
    expect(raw).not.toContain(token);
    expect(raw).toContain(await hashToken(token));
    expect(await app.store.passwordResets.findByTokenHash(await hashToken(token))).toMatchObject({ usedAt: null });
  });

  it('um novo pedido invalida o link anterior', async () => {
    const app = await setup();
    const first = await request(app);
    app.clock.advanceMinutes(2);
    const second = await request(app);
    expect(second.token).not.toBe(first.token);
    expect(await app.services.passwordReset.checkToken(first.token)).toBe('invalid');
    expect(await app.services.passwordReset.checkToken(second.token)).toBe('valid');
  });

  it(`pedidos repetidos em menos de ${PASSWORD_RESET_COOLDOWN_SECONDS}s não geram outro e-mail`, async () => {
    const app = await setup();
    const first = await request(app);
    expect(await app.services.passwordReset.requestReset(VALID_REGISTRATION.email)).toBeNull();
    expect(await app.services.passwordReset.checkToken(first.token)).toBe('valid');
    app.clock.advanceMinutes(1);
    expect(await app.services.passwordReset.requestReset(VALID_REGISTRATION.email)).not.toBeNull();
  });
});

describe('recuperação de senha — link', () => {
  it('identifica link válido, inválido, adulterado, vencido e usado', async () => {
    const app = await setup();
    const { token } = await request(app);
    const reset = app.services.passwordReset;
    expect(await reset.checkToken(token)).toBe('valid');
    expect(await reset.checkToken('nao-e-um-token')).toBe('invalid');
    expect(await reset.checkToken('')).toBe('invalid');
    // Mesmo formato, um caractere trocado: hash diferente, nenhum registro.
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(await reset.checkToken(tampered)).toBe('invalid');

    app.clock.advanceMinutes(15);
    expect(await reset.checkToken(token)).toBe('expired');
  });

  it('o link vale até o último minuto e vence exatamente no prazo', async () => {
    const app = await setup();
    const { token } = await request(app);
    app.clock.now = new Date(app.clock.now.getTime() + 15 * 60_000 - 1);
    expect(await app.services.passwordReset.checkToken(token)).toBe('valid');
    app.clock.now = new Date(app.clock.now.getTime() + 1);
    expect(await app.services.passwordReset.checkToken(token)).toBe('expired');
  });

  it('link de conta excluída deixa de valer', async () => {
    const app = await setup();
    const { token, user } = await request(app);
    await app.services.auth.deleteAccount(user.id, VALID_REGISTRATION.password);
    expect(await app.services.passwordReset.checkToken(token)).toBe('invalid');
  });
});

describe('recuperação de senha — nova senha', () => {
  it('a senha nova funciona, a antiga não, e o link é de uso único', async () => {
    const app = await setup();
    const { token, user } = await request(app);
    expect(await app.services.passwordReset.resetPassword({ token, ...NEW_PASSWORD })).toEqual({ userId: user.id });

    await expectAppError(app.services.auth.login({ email: VALID_REGISTRATION.email, password: VALID_REGISTRATION.password }), 'INVALID_CREDENTIALS');
    expect((await app.services.auth.login({ email: VALID_REGISTRATION.email, password: NEW_PASSWORD.password })).user.id).toBe(user.id);

    expect(await app.services.passwordReset.checkToken(token)).toBe('used');
    await expectAppError(app.services.passwordReset.resetPassword({ token, password: 'outraSenha7', passwordConfirmation: 'outraSenha7' }), 'RESET_TOKEN_INVALID');
    expect((await app.services.auth.login({ email: VALID_REGISTRATION.email, password: NEW_PASSWORD.password })).user.id).toBe(user.id);
  });

  it('aplica a mesma política de senha do cadastro', async () => {
    const app = await setup();
    const { token } = await request(app);
    const reset = app.services.passwordReset;
    await expect(reset.resetPassword({ token, password: 'curta1', passwordConfirmation: 'curta1' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fields: { password: 'A senha precisa ter 8+ caracteres, com letras e números.' },
    });
    await expect(reset.resetPassword({ token, password: 'somenteletras', passwordConfirmation: 'somenteletras' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(reset.resetPassword({ token, password: 'novaSenha9', passwordConfirmation: 'novaSenha8' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fields: { passwordConfirmation: 'As senhas não coincidem.' },
    });
    // Erro de validação não consome o link.
    expect(await reset.checkToken(token)).toBe('valid');
  });

  it('recusa link vencido, adulterado ou inexistente sem trocar a senha', async () => {
    const app = await setup();
    const { token } = await request(app);
    await expectAppError(app.services.passwordReset.resetPassword({ token: 'x'.repeat(43), ...NEW_PASSWORD }), 'RESET_TOKEN_INVALID');
    app.clock.advanceMinutes(16);
    await expectAppError(app.services.passwordReset.resetPassword({ token, ...NEW_PASSWORD }), 'RESET_TOKEN_INVALID');
    expect((await app.services.auth.login({ email: VALID_REGISTRATION.email, password: VALID_REGISTRATION.password })).user.email).toBe(
      VALID_REGISTRATION.email,
    );
  });

  it('dois envios simultâneos com o mesmo link: só um troca a senha', async () => {
    const app = await setup();
    const { token } = await request(app);
    const results = await Promise.allSettled([
      app.services.passwordReset.resetPassword({ token, password: 'primeira1', passwordConfirmation: 'primeira1' }),
      app.services.passwordReset.resetPassword({ token, password: 'segunda22', passwordConfirmation: 'segunda22' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('trocar a senha encerra as sessões abertas (versão da sessão sobe)', async () => {
    const app = await setup();
    const { token, user } = await request(app);
    expect((await app.store.users.findById(user.id))?.sessionVersion ?? 0).toBe(0);
    await app.services.passwordReset.resetPassword({ token, ...NEW_PASSWORD });
    expect((await app.store.users.findById(user.id))?.sessionVersion).toBe(1);
  });

  it('a limpeza periódica remove pedidos vencidos há mais de um dia', async () => {
    const app = await setup();
    await request(app);
    expect(await app.services.passwordReset.purgeExpired()).toBe(0);
    app.clock.advanceDays(2);
    expect(await app.services.passwordReset.purgeExpired()).toBe(1);
  });
});
