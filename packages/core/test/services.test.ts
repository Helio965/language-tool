import { describe, expect, it } from 'vitest';
import { AppError, PLACEMENT_QUESTIONS } from '../src';
import { createTestApp, VALID_REGISTRATION } from './helpers';

const PROFILE = {
  goal: 'conversation' as const,
  perceivedLevel: 'basic' as const,
  priorExperience: 'school' as const,
  conversationInterest: true,
  professionalInterest: false,
  interestAreas: ['technology' as const],
};

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === code);
}

describe('autenticação (UC01, UC02)', () => {
  it('cria conta e direciona para a configuração inicial', async () => {
    const { services } = createTestApp();
    const account = await services.auth.register(VALID_REGISTRATION);
    expect(account.user).toMatchObject({ name: 'Alex Souza', email: 'alex@example.com' });
    expect(account.user).not.toHaveProperty('passwordHash');
    expect(account.nextStep).toBe('onboarding');
  });

  it('normaliza o e-mail e recusa conta duplicada (A2)', async () => {
    const { services } = createTestApp();
    await services.auth.register(VALID_REGISTRATION);
    await expectAppError(services.auth.register({ ...VALID_REGISTRATION, email: '  ALEX@example.com ' }), 'EMAIL_IN_USE');
  });

  it('recusa dados inválidos (A1)', async () => {
    const { services } = createTestApp();
    await expectAppError(services.auth.register({ ...VALID_REGISTRATION, passwordConfirmation: 'outra' }), 'VALIDATION');
  });

  it('autentica com credenciais válidas e recusa as inválidas', async () => {
    const { services } = createTestApp();
    await services.auth.register(VALID_REGISTRATION);
    await expect(services.auth.login({ email: 'alex@example.com', password: 'segura123' })).resolves.toMatchObject({ nextStep: 'onboarding' });
    await expectAppError(services.auth.login({ email: 'alex@example.com', password: 'errada123' }), 'INVALID_CREDENTIALS');
    await expectAppError(services.auth.login({ email: 'ninguem@example.com', password: 'errada123' }), 'INVALID_CREDENTIALS');
  });
});

describe('jornada completa do MVP', () => {
  it('Cadastro → Perfil → Nivelamento → Aula → Exercício → Correção → Progresso → Revisão', async () => {
    const { services, clock } = createTestApp();
    const { user } = await services.auth.register(VALID_REGISTRATION);

    // UC03 — configuração inicial
    await services.profile.saveProfile(user.id, PROFILE);
    expect((await services.auth.getAccount(user.id)).nextStep).toBe('placement');

    // UC04 — nivelamento: acerta a etapa 1, erra a etapa 2 → Básico
    let step = await services.placement.start(user.id);
    const answers: Record<string, string> = {};
    while (step.status === 'continue') {
      for (const question of step.questions) {
        const full = PLACEMENT_QUESTIONS.find((q) => q.id === question.id)!;
        answers[question.id] = full.stage === 'beginner' ? full.answer : 'wrong';
      }
      step = await services.placement.submit(user.id, answers);
    }
    expect(step.result).toMatchObject({ level: 'basic', levelLabel: 'Básico' });
    expect((await services.auth.getAccount(user.id)).nextStep).toBe('ready');

    // Página inicial recomenda a primeira aula do nível
    const home = await services.progress.home(user.id);
    expect(home.continueLesson?.id).toBe('simple-present');
    expect(home.hasActivity).toBe(false);

    // UC05/UC06/UC07 — aula, exercício e correção explicada
    const lesson = await services.learning.getLesson(user.id, 'simple-present');
    expect(lesson.language).toBe('pt');
    expect(lesson.exercises[0]).not.toHaveProperty('acceptedAnswers');
    await services.learning.startLesson(user.id, 'simple-present');
    const wrong = await services.learning.checkAnswer(user.id, 'simple-present', 'present-1', 'go');
    expect(wrong).toMatchObject({ status: 'incorrect', expectedAnswer: 'goes' });
    expect(wrong.explanation).toContain('-s');

    const write = await services.learning.checkAnswer(user.id, 'simple-present', 'present-5', 'She go to school every day.');
    expect(write.status).toBe('incorrect');
    expect(write.correction).toMatchObject({ original: 'She go to school every day.', suggestion: 'She goes to school every day.' });

    for (const id of ['present-2', 'present-3', 'present-4', 'present-6']) {
      await services.learning.checkAnswer(user.id, 'simple-present', id, 'x');
    }
    clock.advanceMinutes(9);
    const result = await services.learning.completeLesson(user.id, 'simple-present', 540);
    expect(result).toMatchObject({ correct: 0, total: 6, score: 0, reviewSuggested: true });
    expect(result.newWords.length).toBeGreaterThan(0);

    // UC11 — progresso
    const progress = await services.progress.overview(user.id);
    expect(progress.totals).toMatchObject({ lessonsCompleted: 1, exercisesDone: 6, accuracy: 0, studyMinutes: 9 });
    expect(progress.needsReview.map((item) => item.reason)).toEqual(expect.arrayContaining(['errors', 'low_score']));

    // UC08 — revisão com motivo; o Início mostra o total pendente, igual à fila
    const queue = await services.review.queue(user.id);
    const homeAfter = await services.progress.home(user.id);
    expect(homeAfter.reviewCount).toBe(queue.due.length);
    expect(homeAfter.reviewDue.length).toBeLessThanOrEqual(3);
    const skillReview = queue.due.find((item) => item.kind === 'skill')!;
    expect(skillReview.reasonText).toContain('Simple Present');
    const session = await services.review.startSession(user.id, skillReview.id);
    expect(session.exercises.length).toBeGreaterThan(0);
    const feedback = await services.review.answer(user.id, skillReview.id, 'present-1', 'goes');
    expect(feedback.status).toBe('correct');
    const reviewResult = await services.review.complete(user.id, skillReview.id, { correct: 1, total: 1, timeSpentSeconds: 60 });
    expect(reviewResult.score).toBe(100);
    expect(reviewResult.nextReviewAt).not.toBeNull();
  });
});

describe('Modo Conversação (UC09)', () => {
  async function readyUser() {
    const app = createTestApp();
    const { user } = await app.services.auth.register(VALID_REGISTRATION);
    await app.services.profile.saveProfile(user.id, PROFILE);
    await app.services.placement.skip(user.id);
    return { ...app, userId: user.id };
  }

  it('conversa mantendo o contexto e corrige de forma discreta', async () => {
    const { services, userId } = await readyUser();
    const conversation = await services.conversation.start(userId, 'introductions');
    expect(conversation.messages[0]?.role).toBe('assistant');

    const first = await services.conversation.send(userId, conversation.id, 'I have 25 years.');
    expect(first.userMessage.corrections[0]).toMatchObject({ original: 'I have 25 years.', suggestion: 'I am 25 years old.' });
    expect(first.assistantMessage.content.length).toBeGreaterThan(0);

    // Logo em seguida, outro erro não interrompe: vai para o resumo.
    const second = await services.conversation.send(userId, conversation.id, 'My sister work in a bank.');
    expect(second.userMessage.corrections).toEqual([]);
    expect(second.userMessage.deferredCorrections).toHaveLength(1);

    const summary = await services.conversation.end(userId, conversation.id);
    expect(summary.userMessages).toBe(2);
    expect(summary.corrections.map((c) => c.suggestion)).toEqual(['I am 25 years old.', 'My sister works in a bank.']);
    await expectAppError(services.conversation.send(userId, conversation.id, 'Hi'), 'CONVERSATION_ENDED');
  });

  it('recomenda no máximo 3 assuntos, priorizando os interesses do perfil', async () => {
    const { services, userId } = await readyUser();
    const topics = await services.conversation.listTopics(userId);
    const recommended = topics.filter((topic) => topic.recommended);
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.length).toBeLessThanOrEqual(3);
    expect(topics.slice(0, recommended.length).every((topic) => topic.recommended)).toBe(true);
    expect(recommended.some((topic) => topic.id === 'free')).toBe(false);
  });

  it('remove dados pessoais da mensagem e avisa o usuário', async () => {
    const { services, userId } = await readyUser();
    const conversation = await services.conversation.start(userId, 'free');
    const { userMessage } = await services.conversation.send(userId, conversation.id, 'My email is alex@example.com');
    expect(userMessage.content).not.toContain('alex@example.com');
    expect(userMessage.notices[0]).toContain('privacidade');
  });

  it('não permite acessar conversas de outra pessoa', async () => {
    const { services, userId } = await readyUser();
    const conversation = await services.conversation.start(userId, 'free');
    const other = await services.auth.register({ ...VALID_REGISTRATION, email: 'bia@example.com' });
    await expectAppError(services.conversation.get(other.user.id, conversation.id), 'NOT_FOUND');
  });

  it('respeita a preferência de não salvar histórico (RN07)', async () => {
    const { services, userId } = await readyUser();
    await services.profile.updatePreferences(userId, { saveConversationHistory: false });
    const conversation = await services.conversation.start(userId, 'travel');
    await services.conversation.send(userId, conversation.id, 'I like the beach.');
    const summary = await services.conversation.end(userId, conversation.id);
    expect(summary.contentDeleted).toBe(true);
    expect(await services.conversation.list(userId)).toEqual([]);
    // Metadados permanecem para o progresso, sem conteúdo.
    expect((await services.progress.overview(userId)).totals.conversations).toBe(1);
  });

  it('apaga conteúdo expirado conforme a retenção', async () => {
    const { services, userId, clock } = await readyUser();
    const conversation = await services.conversation.start(userId, 'free');
    clock.advanceDays(91);
    expect(await services.conversation.purgeExpired()).toBe(1);
    await expect(services.conversation.get(userId, conversation.id)).resolves.toMatchObject({ messages: [] });
  });
});

describe('preferências e dados (UC12, RF20)', () => {
  it('valida e salva preferências', async () => {
    const { services } = createTestApp();
    const { user } = await services.auth.register(VALID_REGISTRATION);
    const prefs = await services.profile.updatePreferences(user.id, { correctionIntensity: 'detailed', dailyGoalMinutes: 15 });
    expect(prefs).toMatchObject({ correctionIntensity: 'detailed', dailyGoalMinutes: 15 });
    await expectAppError(services.profile.updatePreferences(user.id, { correctionIntensity: 'max' as never }), 'VALIDATION');
  });

  it('exclui conta e dados após confirmar a senha', async () => {
    const { services } = createTestApp();
    const { user } = await services.auth.register(VALID_REGISTRATION);
    await services.conversation.start(user.id, 'free');
    await expectAppError(services.auth.deleteAccount(user.id, 'errada'), 'VALIDATION');
    await services.auth.deleteAccount(user.id, 'segura123');
    await expectAppError(services.auth.getAccount(user.id), 'UNAUTHENTICATED');
    await expectAppError(services.auth.login({ email: 'alex@example.com', password: 'segura123' }), 'INVALID_CREDENTIALS');
  });
});
