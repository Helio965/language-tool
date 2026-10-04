import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PLACEMENT_QUESTIONS } from '@english-ai/core';
import { loadConfig } from '../src/config/env';
import { createRuntime } from '../src/composition';
import { createApp } from '../src/http/app';
import { createLogger } from '../src/logger';
import { SessionTokens } from '../src/security/sessionTokens';

const CSRF = { 'X-Requested-With': 'english-ai' };
const USER = {
  name: 'Alex Souza',
  email: 'alex@example.com',
  password: 'segura123',
  passwordConfirmation: 'segura123',
  acceptedTerms: true,
};
const PROFILE = {
  goal: 'conversation',
  perceivedLevel: 'basic',
  priorExperience: 'school',
  conversationInterest: true,
  professionalInterest: false,
  interestAreas: ['technology'],
};

function setup(options: { rateLimited?: boolean } = {}) {
  const logs: string[] = [];
  const logger = createLogger({ sink: (line) => logs.push(line) });
  const config = loadConfig({ NODE_ENV: 'test', AUTH_TOKEN_SECRET: 'x'.repeat(48) });
  const runtime = createRuntime(config, logger, { databasePath: ':memory:' });
  const app = createApp({
    services: runtime.services,
    tokens: new SessionTokens(config.AUTH_TOKEN_SECRET, 1),
    logger,
    corsOrigin: 'http://localhost:5173',
    secureCookies: false,
    aiProvider: runtime.aiProvider,
    rateLimits: { disabled: !options.rateLimited },
  });
  return { app, logs };
}

async function registeredAgent(app: ReturnType<typeof setup>['app'], user = USER) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').set(CSRF).send(user).expect(201);
  return agent;
}

describe('API — infraestrutura e segurança', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('responde ao health check com o provedor de IA ativo', async () => {
    const res = await request(ctx.app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', aiProvider: 'mock' });
  });

  it('aplica cabeçalhos de segurança', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('bloqueia requisições que alteram dados sem o cabeçalho anti-CSRF', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('recusa JSON malformado e rotas inexistentes com respostas padronizadas', async () => {
    await request(ctx.app).post('/api/auth/login').set(CSRF).set('Content-Type', 'application/json').send('{bad').expect(400);
    const res = await request(ctx.app).get('/api/nao-existe').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('exige autenticação nas rotas protegidas', async () => {
    const res = await request(ctx.app).get('/api/home').expect(401);
    expect(res.body.error.message).toContain('Entre novamente');
  });
});

describe('API — autenticação (UC01, UC02)', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('cria conta com cookie httpOnly e SameSite=Strict, sem expor a senha', async () => {
    const res = await request(ctx.app).post('/api/auth/register').set(CSRF).send(USER).expect(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('ea_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api');
    expect(res.body.user).toMatchObject({ name: 'Alex Souza', email: 'alex@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
    expect(res.body.nextStep).toBe('onboarding');
  });

  it('informa conta existente (UC01-A2) e dados inválidos (UC01-A1)', async () => {
    await registeredAgent(ctx.app);
    const duplicate = await request(ctx.app).post('/api/auth/register').set(CSRF).send(USER).expect(409);
    expect(duplicate.body.error).toMatchObject({ code: 'EMAIL_IN_USE' });
    const invalid = await request(ctx.app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ ...USER, email: 'invalido', passwordConfirmation: 'outra' })
      .expect(400);
    expect(Object.keys(invalid.body.error.fields)).toEqual(expect.arrayContaining(['email', 'passwordConfirmation']));
  });

  it('autentica, mantém a sessão e encerra com logout', async () => {
    await registeredAgent(ctx.app);
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/login').set(CSRF).send({ email: 'ALEX@example.com', password: 'segura123' }).expect(200);
    await agent.get('/api/me').expect(200);
    await agent.post('/api/auth/logout').set(CSRF).expect(204);
    await agent.get('/api/me').expect(401);
  });

  it('recusa credenciais inválidas com mensagem genérica (UC02-A1)', async () => {
    await registeredAgent(ctx.app);
    const wrong = await request(ctx.app).post('/api/auth/login').set(CSRF).send({ email: USER.email, password: 'errada123' }).expect(401);
    const unknown = await request(ctx.app).post('/api/auth/login').set(CSRF).send({ email: 'x@y.com', password: 'errada123' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('não revela se o e-mail existe na recuperação de senha', async () => {
    await registeredAgent(ctx.app);
    const existing = await request(ctx.app).post('/api/auth/password-reset').set(CSRF).send({ email: USER.email }).expect(202);
    const missing = await request(ctx.app).post('/api/auth/password-reset').set(CSRF).send({ email: 'x@y.com' }).expect(202);
    expect(existing.body).toEqual(missing.body);
  });

  it('não registra e-mail, senha nem conteúdo nos logs', async () => {
    const agent = await registeredAgent(ctx.app);
    await agent.put('/api/me/profile').set(CSRF).send(PROFILE).expect(200);
    const all = ctx.logs.join('\n');
    expect(all).toContain('http.request');
    expect(all).not.toContain('alex@example.com');
    expect(all).not.toContain('segura123');
  });

  it('limita tentativas de login (proteção contra força bruta)', async () => {
    const limited = setup({ rateLimited: true });
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await request(limited.app).post('/api/auth/login').set(CSRF).send({ email: 'x@y.com', password: 'errada123' })).status;
    }
    expect(last).toBe(429);
  });
});

describe('API — jornada do MVP', () => {
  it('Perfil → Nivelamento → Aula → Exercício → Progresso → Conversa → Revisão', async () => {
    const { app } = setup();
    const agent = await registeredAgent(app);

    await agent.put('/api/me/profile').set(CSRF).send(PROFILE).expect(200);
    expect((await agent.get('/api/me')).body.nextStep).toBe('placement');

    let step = (await agent.post('/api/placement/start').set(CSRF).expect(200)).body;
    const answers: Record<string, string> = {};
    while (step.status === 'continue') {
      expect(step.questions[0]).not.toHaveProperty('answer');
      for (const question of step.questions) {
        const full = PLACEMENT_QUESTIONS.find((q) => q.id === question.id)!;
        answers[question.id] = full.stage === 'intermediate' ? 'wrong' : full.answer;
      }
      step = (await agent.post('/api/placement/answers').set(CSRF).send({ answers }).expect(200)).body;
    }
    expect(step.result).toMatchObject({ level: 'intermediate', levelLabel: 'Intermediário' });

    const home = (await agent.get('/api/home').expect(200)).body;
    expect(home.continueLesson.id).toBe('present-perfect');

    const lesson = (await agent.get('/api/lessons/present-perfect').expect(200)).body;
    expect(lesson.language).toBe('en');
    expect(lesson.exercises[0]).not.toHaveProperty('acceptedAnswers');
    await agent.post('/api/lessons/present-perfect/start').set(CSRF).expect(204);
    const feedback = (
      await agent.post('/api/lessons/present-perfect/exercises/perfect-1/answer').set(CSRF).send({ answer: 'lived' }).expect(200)
    ).body;
    expect(feedback).toMatchObject({ status: 'incorrect', expectedAnswer: 'have lived' });
    const result = (await agent.post('/api/lessons/present-perfect/complete').set(CSRF).send({ timeSpentSeconds: 300 }).expect(200)).body;
    expect(result).toMatchObject({ total: 5, correct: 0 });

    const progress = (await agent.get('/api/progress').expect(200)).body;
    expect(progress.totals).toMatchObject({ lessonsCompleted: 1, exercisesDone: 1, studyMinutes: 5 });

    const conversation = (await agent.post('/api/conversations').set(CSRF).send({ topicId: 'work' }).expect(201)).body;
    const turn = (
      await agent.post(`/api/conversations/${conversation.id}/messages`).set(CSRF).send({ text: 'She go to work by bus.' }).expect(201)
    ).body;
    expect(turn.userMessage.corrections[0].suggestion).toBe('She goes to work by bus.');
    const summary = (await agent.post(`/api/conversations/${conversation.id}/end`).set(CSRF).expect(200)).body;
    expect(summary.userMessages).toBe(1);

    const reviews = (await agent.get('/api/reviews').expect(200)).body;
    expect(reviews.due.length).toBeGreaterThan(0);
    const vocabulary = (await agent.get('/api/vocabulary').expect(200)).body;
    expect(vocabulary.counts.studied).toBeGreaterThan(0);
  });

  it('impede acesso a conversas de outro usuário e respeita a exclusão de dados (RF20)', async () => {
    const { app } = setup();
    const alex = await registeredAgent(app);
    const bia = await registeredAgent(app, { ...USER, email: 'bia@example.com', name: 'Bia' });
    const conversation = (await alex.post('/api/conversations').set(CSRF).send({ topicId: 'free' }).expect(201)).body;
    await bia.get(`/api/conversations/${conversation.id}`).expect(404);
    await bia.post(`/api/conversations/${conversation.id}/messages`).set(CSRF).send({ text: 'hi' }).expect(404);

    await alex.delete('/api/me').set(CSRF).send({ password: 'errada' }).expect(400);
    await alex.delete('/api/me').set(CSRF).send({ password: 'segura123' }).expect(204);
    await alex.get('/api/me').expect(401);
    await request(app).post('/api/auth/login').set(CSRF).send({ email: USER.email, password: 'segura123' }).expect(401);
  });

  it('valida preferências (UC12)', async () => {
    const { app } = setup();
    const agent = await registeredAgent(app);
    const prefs = (await agent.patch('/api/me/preferences').set(CSRF).send({ correctionIntensity: 'light' }).expect(200)).body;
    expect(prefs.correctionIntensity).toBe('light');
    await agent.patch('/api/me/preferences').set(CSRF).send({ correctionIntensity: 'nenhuma' }).expect(400);
  });
});
