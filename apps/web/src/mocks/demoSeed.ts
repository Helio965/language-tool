/**
 * DADOS DE DEMONSTRAÇÃO (mock) — separados dos dados reais.
 * Cria a conta de exemplo "Alex" com alguns dias de estudo, para visualizar o sistema funcionando.
 * Usado apenas no modo demonstração, quando o usuário clica em "Explorar demonstração".
 * Tudo passa pelos mesmos casos de uso do core, então os dados são coerentes com as regras reais.
 */
import {
  createAppServices,
  PLACEMENT_QUESTIONS,
  type AIService,
  type ContentCatalog,
  type DataStore,
  type PasswordHasher,
} from '@english-ai/core';

export const DEMO_ACCOUNT = {
  name: 'Alex',
  email: 'alex@demo.englishai.app',
  password: 'demo1234',
} as const;

interface SeedDeps {
  store: DataStore;
  catalog: ContentCatalog;
  ai: AIService;
  passwordHasher: PasswordHasher;
  generateId: () => string;
}

/** Plano de estudo simulado: dias atrás → aula, exercícios errados e tempo. */
const LESSON_PLAN: Array<{ daysAgo: number; lessonId: string; wrong: string[]; minutes: number; complete: boolean }> = [
  { daysAgo: 9, lessonId: 'greetings', wrong: [], minutes: 7, complete: true },
  { daysAgo: 7, lessonId: 'verb-to-be', wrong: ['to-be-4'], minutes: 11, complete: true },
  { daysAgo: 6, lessonId: 'numbers-age', wrong: ['numbers-2'], minutes: 8, complete: true },
  { daysAgo: 4, lessonId: 'simple-present', wrong: ['present-1', 'present-3'], minutes: 12, complete: true },
  { daysAgo: 2, lessonId: 'questions-negatives', wrong: ['questions-3'], minutes: 10, complete: true },
  { daysAgo: 0, lessonId: 'prepositions', wrong: ['prepositions-2'], minutes: 6, complete: false },
];

const OPEN_ANSWERS: Record<string, string> = {
  'to-be-6': "I'm Alex and I'm a developer from Recife.",
  'present-5': 'She go to the gym every morning.',
};

export async function seedDemoAccount(deps: SeedDeps): Promise<void> {
  const base = Date.now();
  let offsetMs = 0;
  const at = (daysAgo: number, hour = 19) => {
    const date = new Date(base - daysAgo * 86_400_000);
    date.setHours(hour, 0, 0, 0);
    offsetMs = Math.min(date.getTime(), base) - base;
  };
  const advance = (minutes: number) => {
    offsetMs = Math.min(offsetMs + minutes * 60_000, 0);
  };
  const services = createAppServices({ ...deps, now: () => new Date(base + offsetMs) });

  at(10, 20);
  const { user } = await services.auth.register({
    name: DEMO_ACCOUNT.name,
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
    passwordConfirmation: DEMO_ACCOUNT.password,
    acceptedTerms: true,
  });
  await services.profile.saveProfile(user.id, {
    goal: 'conversation',
    perceivedLevel: 'beginner',
    priorExperience: 'school',
    conversationInterest: true,
    professionalInterest: true,
    interestAreas: ['technology', 'travel'],
  });

  // Nivelamento: vai bem na etapa Iniciante e erra metade da Básico → nível estimado Básico.
  const answers: Record<string, string> = {};
  let step = await services.placement.start(user.id);
  while (step.status === 'continue') {
    for (const question of step.questions) {
      const full = PLACEMENT_QUESTIONS.find((item) => item.id === question.id);
      if (!full) continue;
      const missBasic = full.stage === 'basic' && (full.id === 'p6' || full.id === 'p7');
      answers[question.id] = missBasic ? (full.options.find((option) => option !== full.answer) ?? '') : full.answer;
    }
    step = await services.placement.submit(user.id, answers);
  }

  for (const plan of LESSON_PLAN) {
    at(plan.daysAgo, plan.daysAgo === 0 ? Math.max(0, new Date(base).getHours() - 1) : 19);
    const lesson = deps.catalog.lesson(plan.lessonId);
    if (!lesson) continue;
    await services.learning.startLesson(user.id, lesson.id);
    const exercises = plan.complete ? lesson.exercises : lesson.exercises.slice(0, 3);
    for (const exercise of exercises) {
      advance(1);
      const answer =
        OPEN_ANSWERS[exercise.id] ??
        (plan.wrong.includes(exercise.id)
          ? (exercise.options?.find((option) => option !== exercise.acceptedAnswers[0]) ?? 'x')
          : (exercise.acceptedAnswers[0] ?? 'x'));
      await services.learning.checkAnswer(user.id, lesson.id, exercise.id, answer);
    }
    if (plan.complete) {
      advance(2);
      await services.learning.completeLesson(user.id, lesson.id, plan.minutes * 60);
    }
  }

  // Uma conversa salva, com correções discretas e o resumo final.
  at(1, 21);
  const conversation = await services.conversation.start(user.id, 'travel');
  for (const text of ['Yes! I love the beach. I have 25 years and I want to see the world.', 'I want to go to Canada.', 'My sister work in a travel agency, she help me a lot.']) {
    advance(2);
    await services.conversation.send(user.id, conversation.id, text);
  }
  advance(1);
  await services.conversation.end(user.id, conversation.id);

  // Algumas palavras já aprendidas.
  for (const wordId of ['hello', 'good-morning', 'student']) {
    await services.vocabulary.setStatus(user.id, wordId, 'learned');
  }
  offsetMs = 0;
  await services.review.queue(user.id);
}
