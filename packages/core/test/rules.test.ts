import { describe, expect, it } from 'vitest';
import {
  checkWriteRequirements,
  computeDifficulties,
  computeProgress,
  computeStreak,
  createStaticCatalog,
  evaluatePlacement,
  gradeClosedExercise,
  LESSONS,
  normalizeAnswer,
  PLACEMENT_PASS_THRESHOLD,
  PLACEMENT_QUESTIONS,
  PLACEMENT_STAGES,
  planReviews,
  redactSensitiveData,
  scheduleWord,
  shouldLevelUp,
  validateRegistration,
  type ExerciseAttempt,
  type Progress,
} from '../src';

const catalog = createStaticCatalog();
const exercise = (id: string) => {
  const found = catalog.exercise(id);
  if (!found) throw new Error(`missing ${id}`);
  return found.exercise;
};

describe('normalização e correção de exercícios', () => {
  it('ignora maiúsculas, pontuação, apóstrofos tipográficos e contrações', () => {
    expect(normalizeAnswer("  What’s your NAME?  ")).toBe(normalizeAnswer('what is your name'));
    expect(normalizeAnswer("He's happy.")).toBe('he is happy');
  });

  it('aceita respostas equivalentes', () => {
    expect(gradeClosedExercise(exercise('to-be-5'), "he's happy").status).toBe('correct');
    expect(gradeClosedExercise(exercise('greetings-4'), 'What is your name').status).toBe('correct');
  });

  it('identifica erro de digitação como "quase"', () => {
    expect(gradeClosedExercise(exercise('present-6'), 'She studies English everyday.').status).toBe('almost');
  });

  it('marca resposta errada e informa a forma recomendada', () => {
    const result = gradeClosedExercise(exercise('present-1'), 'go');
    expect(result).toEqual({ status: 'incorrect', expected: 'goes' });
  });

  it('valida requisitos de respostas abertas', () => {
    const write = exercise('present-5');
    expect(checkWriteRequirements(write, 'I work').ok).toBe(false);
    expect(checkWriteRequirements(write, 'I work every day here').message).toContain('he');
    expect(checkWriteRequirements(write, 'She works in a hospital').ok).toBe(true);
  });
});

describe('nivelamento por etapas (UC04)', () => {
  const answerStage = (stage: string, correct: number) =>
    Object.fromEntries(
      PLACEMENT_QUESTIONS.filter((q) => q.stage === stage).map((q, index) => [
        q.id,
        index < correct ? q.answer : q.options.find((option) => option !== q.answer) ?? '',
      ]),
    );
  const evaluate = (answers: Record<string, string>) =>
    evaluatePlacement(PLACEMENT_QUESTIONS, PLACEMENT_STAGES, PLACEMENT_PASS_THRESHOLD, answers);

  it('começa pela primeira etapa sem expor o gabarito', () => {
    const step = evaluate({});
    expect(step.status).toBe('continue');
    if (step.status === 'continue') {
      expect(step.stageNumber).toBe(1);
      expect(step.questions[0]).not.toHaveProperty('answer');
    }
  });

  it('para cedo e estima Iniciante quando a primeira etapa vai mal', () => {
    const step = evaluate(answerStage('beginner', 1));
    expect(step).toMatchObject({ status: 'done', evaluation: { level: 'beginner', answered: 4, correct: 1 } });
  });

  it('apresenta novas atividades quando o usuário vai bem', () => {
    const step = evaluate(answerStage('beginner', 4));
    expect(step).toMatchObject({ status: 'continue', stageNumber: 2 });
  });

  it('estima Básico, Intermediário e Avançado conforme as etapas superadas', () => {
    expect(evaluate({ ...answerStage('beginner', 4), ...answerStage('basic', 2) })).toMatchObject({ evaluation: { level: 'basic' } });
    expect(
      evaluate({ ...answerStage('beginner', 4), ...answerStage('basic', 3), ...answerStage('intermediate', 1) }),
    ).toMatchObject({ evaluation: { level: 'intermediate' } });
    expect(
      evaluate({ ...answerStage('beginner', 4), ...answerStage('basic', 4), ...answerStage('intermediate', 4) }),
    ).toMatchObject({ evaluation: { level: 'advanced', score: 100 } });
  });
});

const attempt = (overrides: Partial<ExerciseAttempt>): ExerciseAttempt => ({
  id: Math.random().toString(36),
  userId: 'u1',
  exerciseId: 'present-1',
  lessonId: 'simple-present',
  skillTag: 'simple_present',
  context: 'lesson',
  answer: 'x',
  isCorrect: true,
  createdAt: '2026-03-02T12:00:00.000Z',
  ...overrides,
});

const completed = (lessonId: string, score: number, completedAt = '2026-03-01T12:00:00.000Z'): Progress => ({
  userId: 'u1',
  lessonId,
  status: 'completed',
  correctCount: 4,
  totalCount: 5,
  score,
  timeSpentSeconds: 600,
  startedAt: completedAt,
  completedAt,
  updatedAt: completedAt,
});

describe('progresso (UC11)', () => {
  it('conta sequência de dias terminando hoje ou ontem', () => {
    expect(computeStreak(new Set(['2026-03-01', '2026-03-02']), '2026-03-02')).toBe(2);
    expect(computeStreak(new Set(['2026-02-28', '2026-03-01']), '2026-03-02')).toBe(2);
    expect(computeStreak(new Set(['2026-02-27']), '2026-03-02')).toBe(0);
  });

  it('calcula indicadores simples a partir dos registros', () => {
    const snapshot = computeProgress({
      now: new Date('2026-03-02T15:00:00.000Z'),
      timeZone: 'America/Sao_Paulo',
      estimatedLevel: 'beginner',
      lessons: LESSONS,
      progress: [completed('greetings', 80)],
      attempts: [attempt({ isCorrect: true }), attempt({ isCorrect: false }), attempt({ context: 'placement' })],
      vocabulary: [],
      reviews: [],
      conversations: [{ startedAt: '2026-03-02T14:00:00.000Z', lastActivityAt: '2026-03-02T14:10:00.000Z', userMessages: 4, correctedSkills: ['to_be', 'to_be'] }],
    });
    expect(snapshot.totals).toMatchObject({ lessonsCompleted: 1, exercisesDone: 2, accuracy: 50, conversations: 1, studyMinutes: 20 });
    expect(snapshot.level).toMatchObject({ level: 'beginner', completedInLevel: 1, totalInLevel: 5, percent: 20 });
    expect(snapshot.recurringErrors[0]).toMatchObject({ skillTag: 'to_be', count: 2 });
    expect(snapshot.week).toHaveLength(7);
  });

  it('identifica dificuldades recorrentes', () => {
    const attempts = [attempt({ isCorrect: false }), attempt({ isCorrect: false }), attempt({ isCorrect: true })];
    expect(computeDifficulties(attempts)).toEqual(['simple_present']);
  });

  it('avança o nível estimado ao concluir o nível com média ≥ 70%', () => {
    const beginner = LESSONS.filter((lesson) => lesson.level === 'beginner');
    expect(shouldLevelUp('beginner', LESSONS, beginner.map((lesson) => completed(lesson.id, 80)))).toBe('basic');
    expect(shouldLevelUp('beginner', LESSONS, beginner.map((lesson) => completed(lesson.id, 40)))).toBeNull();
    expect(shouldLevelUp('beginner', LESSONS, beginner.slice(1).map((lesson) => completed(lesson.id, 100)))).toBeNull();
  });
});

describe('revisão (UC08)', () => {
  const now = new Date('2026-03-05T12:00:00.000Z');

  it('cria revisões a partir de erros, nota baixa, revisão espaçada e vocabulário vencido', () => {
    const planned = planReviews({
      now,
      progress: [completed('greetings', 40), completed('verb-to-be', 90)],
      difficulties: ['simple_present'],
      vocabulary: [
        { userId: 'u1', vocabularyId: 'red', status: 'learning', timesReviewed: 0, firstSeenAt: '', lastReviewedAt: null, nextReviewAt: '2026-03-04T00:00:00.000Z' },
      ],
      existing: [],
    });
    expect(planned.map((item) => `${item.kind}:${item.refId}:${item.reason}`)).toEqual([
      'skill:simple_present:errors',
      'lesson:greetings:low_score',
      'lesson:verb-to-be:spaced',
      'vocabulary:vocabulary:vocabulary_due',
    ]);
  });

  it('agenda palavras com intervalos crescentes', () => {
    const item = { userId: 'u1', vocabularyId: 'red', status: 'learning' as const, timesReviewed: 2, firstSeenAt: '', lastReviewedAt: null, nextReviewAt: '' };
    expect(scheduleWord(item, true, now)).toMatchObject({ status: 'learned', timesReviewed: 3 });
    expect(scheduleWord(item, false, now).nextReviewAt).toBe('2026-03-06T12:00:00.000Z');
  });
});

describe('validação e privacidade', () => {
  it('valida o cadastro com mensagens claras', () => {
    const errors = validateRegistration({ name: '', email: 'x', password: 'abc', passwordConfirmation: 'abd', acceptedTerms: false });
    expect(Object.keys(errors).sort()).toEqual(['acceptedTerms', 'email', 'name', 'password', 'passwordConfirmation']);
  });

  it('remove dados pessoais antes de enviar à IA', () => {
    const result = redactSensitiveData('my email is ana@mail.com and my phone is (11) 98765-4321');
    expect(result.text).not.toContain('ana@mail.com');
    expect(result.text).not.toContain('98765');
    expect(result.redactedKinds).toEqual(expect.arrayContaining(['e-mail', 'telefone']));
    expect(redactSensitiveData('I am 25 years old').redactedKinds).toEqual([]);
  });
});
