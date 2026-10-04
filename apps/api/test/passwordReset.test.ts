import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { createRuntime } from '../src/composition';
import { MemoryMailer } from '../src/email/mailers';
import type { Mailer } from '../src/email/types';
import { createApp } from '../src/http/app';
import { createLogger } from '../src/logger';
import { SessionTokens } from '../src/security/sessionTokens';

const CSRF = { 'X-Requested-With': 'english-ai' };
const APP_URL = 'https://englishai.example.com';
const USER = {
  name: 'Carla Dias',
  email: 'carla@example.com',
  password: 'segura123',
  passwordConfirmation: 'segura123',
  acceptedTerms: true,
};
const NEW_PASSWORD = { password: 'novaSenha9', passwordConfirmation: 'novaSenha9' };
const GENERIC = 'Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.';

function setup(options: { mailer?: Mailer; rateLimited?: boolean } = {}) {
  const logs: string[] = [];
  const logger = createLogger({ sink: (line) => logs.push(line) });
  const config = loadConfig({ NODE_ENV: 'test', AUTH_TOKEN_SECRET: 'x'.repeat(48), APP_PUBLIC_URL: APP_URL });
  const mailer = options.mailer ?? new MemoryMailer();
  const runtime = createRuntime(config, logger, { databasePath: ':memory:', mailer });
  const app = createApp({
    services: runtime.services,
    tokens: new SessionTokens(config.AUTH_TOKEN_SECRET, 1),
    logger,
    corsOrigin: 'http://localhost:5173',
    secureCookies: false,
    aiProvider: runtime.aiProvider,
    rateLimits: { disabled: !options.rateLimited },
    email: runtime.email,
  });
  return { app, runtime, mailer, logs };
}

type Ctx = ReturnType<typeof setup>;

async function register(ctx: Ctx, user = USER) {
  const agent = request.agent(ctx.app);
  await agent.post('/api/auth/register').set(CSRF).send(user).expect(201);
  await ctx.runtime.email.idle();
  return agent;
}

async function requestReset(ctx: Ctx, email = USER.email) {
  const response = await request(ctx.app).post('/api/auth/password-reset').set(CSRF).send({ email });
  await ctx.runtime.email.idle();
  return response;
}

function tokenFrom(mailer: MemoryMailer, email = USER.email): string {
  const text = mailer.lastTo(email)?.text ?? '';
  const match = text.match(/\/redefinir-senha\/([A-Za-z0-9_-]{43})/);
  if (!match?.[1]) throw new Error('e-mail de redefinição sem link');
  return match[1];
}

const confirm = (ctx: Ctx, token: string, body = NEW_PASSWORD) =>
  request(ctx.app).post('/api/auth/password-reset/confirm').set(CSRF).send({ token, ...body });
const verify = async (ctx: Ctx, token: string) =>
  (await request(ctx.app).post('/api/auth/password-reset/verify').set(CSRF).send({ token }).expect(200)).body.status as string;
const login = (ctx: Ctx, password: string) =>
  request(ctx.app).post('/api/auth/login').set(CSRF).send({ email: USER.email, password });

describe('API — pedido de recuperação de senha', () => {
  it('conta existente e e-mail desconhecido recebem exatamente a mesma resposta', async () => {
    const ctx = setup();
    await register(ctx);
    const mailer = ctx.mailer as MemoryMailer;
    mailer.clear();

    const known = await requestReset(ctx, USER.email);
    const unknown = await requestReset(ctx, 'ninguem@example.com');
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual({ message: GENERIC, expiresInMinutes: 15 });
    expect(unknown.body).toEqual(known.body);
    expect(Object.keys(unknown.headers).sort()).toEqual(Object.keys(known.headers).sort());

    // Só a conta existente recebe e-mail; nada é enviado para o endereço desconhecido.
    expect(mailer.messages.map((message) => message.to)).toEqual([USER.email]);
  });

  it('o e-mail tem destinatário, assunto, link com o domínio público e validade — sem senha nem hash', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const message = (ctx.mailer as MemoryMailer).lastTo(USER.email);
    expect(message).toMatchObject({ to: USER.email, kind: 'password_reset', subject: 'Redefinição de senha — English AI' });
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    expect(message?.html).toContain(`href="${APP_URL}/redefinir-senha/${token}"`);
    expect(message?.text).toContain('15 minutos');
    const content = `${message?.html}${message?.text}`;
    expect(content).not.toContain(USER.password);
    expect(content).not.toMatch(/[0-9a-f]{64}/);
    expect(content).not.toMatch(/scrypt\$/);
  });

  it('o link não usa o cabeçalho Host da requisição (proteção contra links forjados)', async () => {
    const ctx = setup();
    await register(ctx);
    await request(ctx.app).post('/api/auth/password-reset').set(CSRF).set('Host', 'evil.example.com').send({ email: USER.email });
    await ctx.runtime.email.idle();
    expect((ctx.mailer as MemoryMailer).lastTo(USER.email)?.text).toContain(`${APP_URL}/redefinir-senha/`);
    expect((ctx.mailer as MemoryMailer).lastTo(USER.email)?.text).not.toContain('evil.example.com');
  });

  it('e-mail mal formatado recebe erro de validação; não há resposta que revele contas', async () => {
    const ctx = setup();
    const response = await request(ctx.app).post('/api/auth/password-reset').set(CSRF).send({ email: 'sem-arroba' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });

  it('o token nunca aparece nos logs nem na resposta', async () => {
    const ctx = setup();
    await register(ctx);
    const response = await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(ctx.logs.join('\n')).not.toContain(token);
    expect(ctx.logs.join('\n')).not.toContain(USER.email);
  });

  it('limita pedidos repetidos por IP (429) para evitar disparo de e-mails em massa', async () => {
    const ctx = setup({ rateLimited: true });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await requestReset(ctx, `pessoa${i}@example.com`)).status);
    expect(statuses.slice(0, 10).every((status) => status === 202)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('API — redefinição de senha', () => {
  it('jornada completa: link válido → senha nova funciona, a antiga não, e o link não pode ser reutilizado', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);

    expect(await verify(ctx, token)).toBe('valid');
    const done = await confirm(ctx, token);
    expect(done.status).toBe(200);
    expect(done.body).toEqual({ message: 'Senha redefinida com sucesso.', sessionEnded: false });

    expect((await login(ctx, USER.password)).status).toBe(401);
    expect((await login(ctx, NEW_PASSWORD.password)).status).toBe(200);

    expect(await verify(ctx, token)).toBe('used');
    const reuse = await confirm(ctx, token, { password: 'outraSenha7', passwordConfirmation: 'outraSenha7' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('RESET_TOKEN_INVALID');
    expect((await login(ctx, NEW_PASSWORD.password)).status).toBe(200);
  });

  it('link inválido, adulterado ou vencido é recusado', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    expect(await verify(ctx, 'qualquer-coisa')).toBe('invalid');
    expect(await verify(ctx, tampered)).toBe('invalid');
    expect((await confirm(ctx, tampered)).body.error.code).toBe('RESET_TOKEN_INVALID');

    ctx.runtime.db.prepare("UPDATE password_reset_tokens SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect(await verify(ctx, token)).toBe('expired');
    expect((await confirm(ctx, token)).body.error.code).toBe('RESET_TOKEN_INVALID');
    expect((await login(ctx, USER.password)).status).toBe(200);
  });

  it('um novo pedido invalida o link anterior', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const first = tokenFrom(ctx.mailer as MemoryMailer);
    // Passa o intervalo mínimo entre e-mails.
    ctx.runtime.db.prepare("UPDATE password_reset_tokens SET created_at = '2000-01-01T00:00:00.000Z'").run();
    await requestReset(ctx);
    const second = tokenFrom(ctx.mailer as MemoryMailer);
    expect(second).not.toBe(first);
    expect(await verify(ctx, first)).toBe('invalid');
    expect(await verify(ctx, second)).toBe('valid');
  });

  it('aplica a política de senha do cadastro sem consumir o link', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    const weak = await confirm(ctx, token, { password: 'curta1', passwordConfirmation: 'curta1' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toMatchObject({ code: 'VALIDATION', fields: { password: expect.stringContaining('8+') } });
    const mismatch = await confirm(ctx, token, { password: 'novaSenha9', passwordConfirmation: 'outra' });
    expect(mismatch.body.error.fields).toMatchObject({ passwordConfirmation: 'As senhas não coincidem.' });
    expect(await verify(ctx, token)).toBe('valid');
  });

  it('o banco guarda só o hash do token', async () => {
    const ctx = setup();
    await register(ctx);
    await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    const rows = ctx.runtime.db.prepare('SELECT * FROM password_reset_tokens').all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('API — sessões depois da redefinição', () => {
  it('sessões abertas antes da troca de senha deixam de valer em todos os aparelhos', async () => {
    const ctx = setup();
    const phone = await register(ctx);
    const laptop = request.agent(ctx.app);
    await laptop.post('/api/auth/login').set(CSRF).send({ email: USER.email, password: USER.password }).expect(200);
    await phone.get('/api/me').expect(200);
    await laptop.get('/api/me').expect(200);

    await requestReset(ctx);
    await confirm(ctx, tokenFrom(ctx.mailer as MemoryMailer)).expect(200);

    expect((await phone.get('/api/me')).status).toBe(401);
    expect((await laptop.get('/api/me')).status).toBe(401);
    // /auth/session responde "visitante" e remove o cookie antigo.
    const session = await phone.get('/api/auth/session').expect(200);
    expect(session.body).toEqual({ account: null });
    expect(String(session.headers['set-cookie'])).toMatch(/ea_session=;/);

    // Entrar de novo (com a senha nova) cria uma sessão válida.
    await phone.post('/api/auth/login').set(CSRF).send({ email: USER.email, password: NEW_PASSWORD.password }).expect(200);
    await phone.get('/api/me').expect(200);
  });

  it('se o próprio navegador estava conectado à conta, a resposta informa e remove o cookie', async () => {
    const ctx = setup();
    const agent = await register(ctx);
    await requestReset(ctx);
    const token = tokenFrom(ctx.mailer as MemoryMailer);
    const response = await agent.post('/api/auth/password-reset/confirm').set(CSRF).send({ token, ...NEW_PASSWORD }).expect(200);
    expect(response.body.sessionEnded).toBe(true);
    expect(String(response.headers['set-cookie'])).toMatch(/ea_session=;/);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  it('sessão de outra conta no mesmo navegador não é encerrada', async () => {
    const ctx = setup();
    await register(ctx);
    const other = await register(ctx, { ...USER, name: 'Davi', email: 'davi@example.com' });
    await requestReset(ctx);
    const response = await other
      .post('/api/auth/password-reset/confirm')
      .set(CSRF)
      .send({ token: tokenFrom(ctx.mailer as MemoryMailer), ...NEW_PASSWORD })
      .expect(200);
    expect(response.body.sessionEnded).toBe(false);
    await other.get('/api/me').expect(200);
  });
});

describe('API — e-mail de boas-vindas', () => {
  it('é enviado após o cadastro, com o nome e o link do app, sem a senha', async () => {
    const ctx = setup();
    await register(ctx);
    const message = (ctx.mailer as MemoryMailer).lastTo(USER.email);
    expect(message).toMatchObject({ kind: 'welcome', subject: 'Boas-vindas ao English AI' });
    expect(message?.html).toContain('Boas-vindas, Carla!');
    expect(message?.html).toContain(`${APP_URL}/entrar`);
    expect(`${message?.html}${message?.text}`).not.toContain(USER.password);
  });

  it('falha do SMTP não desfaz o cadastro nem aparece para o navegador', async () => {
    const failing: Mailer = {
      transport: 'smtp',
      send: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:587 user=carla@example.com'), { code: 'ECONNECTION' });
      },
    };
    const ctx = setup({ mailer: failing });
    const agent = request.agent(ctx.app);
    const response = await agent.post('/api/auth/register').set(CSRF).send(USER);
    await ctx.runtime.email.idle();
    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toMatch(/ECONN|SMTP|10\.0\.0\.1/);
    await agent.get('/api/me').expect(200);
    expect((await login(ctx, USER.password)).status).toBe(200);
    const log = ctx.logs.join('\n');
    expect(log).toContain('"event":"email.failed"');
    expect(log).toContain('"code":"ECONNECTION"');
    expect(log).not.toContain(USER.email);
  });

  it('falha do SMTP na recuperação: mesma resposta genérica, sem detalhes do servidor', async () => {
    let fail = false;
    const flaky: Mailer = {
      transport: 'smtp',
      send: async () => {
        if (fail) throw Object.assign(new Error('535 auth failed'), { code: 'EAUTH' });
      },
    };
    const ctx = setup({ mailer: flaky });
    await register(ctx);
    fail = true;
    const known = await requestReset(ctx, USER.email);
    const unknown = await requestReset(ctx, 'ninguem@example.com');
    expect(known.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(JSON.stringify(known.body)).not.toMatch(/535|EAUTH|SMTP/);
    expect(ctx.logs.join('\n')).toContain('"code":"EAUTH"');
  });
});

describe('API — compatibilidade das sessões', () => {
  it('cookies emitidos antes desta versão (sem versão de sessão) continuam válidos até a senha mudar', async () => {
    const ctx = setup();
    await register(ctx);
    const account = await ctx.runtime.services.auth.login({ email: USER.email, password: USER.password });
    const jwt = await import('jsonwebtoken');
    // Formato antigo: só subject, audience e validade — sem a versão "sv".
    const legacy = jwt.default.sign({}, 'x'.repeat(48), { algorithm: 'HS256', subject: account.user.id, expiresIn: '1h', audience: 'english-ai' });
    const tokens = new SessionTokens('x'.repeat(48), 1);
    expect(tokens.read(legacy)).toEqual({ userId: account.user.id, sessionVersion: 0 });
    await request(ctx.app).get('/api/me').set('Cookie', `ea_session=${legacy}`).expect(200);

    await requestReset(ctx);
    await confirm(ctx, tokenFrom(ctx.mailer as MemoryMailer)).expect(200);
    await request(ctx.app).get('/api/me').set('Cookie', `ea_session=${legacy}`).expect(401);
  });
});
