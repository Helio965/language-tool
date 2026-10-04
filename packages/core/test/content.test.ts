import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_TOPICS,
  createStaticCatalog,
  LESSONS,
  normalizeAnswer,
  PLACEMENT_QUESTIONS,
  SKILL_LESSON,
  VOCABULARY,
} from '../src';

describe('integridade do conteúdo pedagógico', () => {
  const catalog = createStaticCatalog();

  it('tem ids únicos para aulas, exercícios e vocabulário', () => {
    const lessonIds = LESSONS.map((lesson) => lesson.id);
    const exerciseIds = LESSONS.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id));
    const vocabularyIds = VOCABULARY.map((entry) => entry.id);
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(new Set(exerciseIds).size).toBe(exerciseIds.length);
    expect(new Set(vocabularyIds).size).toBe(vocabularyIds.length);
  });

  it('segue uma progressão de dificuldade (RN02)', () => {
    const order = ['beginner', 'basic', 'intermediate', 'advanced'];
    const levels = LESSONS.map((lesson) => order.indexOf(lesson.level));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(LESSONS.map((lesson) => lesson.level)).size).toBe(4);
  });

  it.each(LESSONS.flatMap((lesson) => lesson.exercises.map((exercise) => [exercise.id, exercise] as const)))(
    'exercício %s é consistente',
    (_id, exercise) => {
      if (exercise.type === 'write') {
        expect(exercise.requirements?.length).toBeGreaterThan(0);
        return;
      }
      expect(exercise.acceptedAnswers.length).toBeGreaterThan(0);
      if (exercise.type === 'multiple_choice' || exercise.type === 'select_word') {
        const options = (exercise.options ?? []).map(normalizeAnswer);
        expect(options).toContain(normalizeAnswer(exercise.acceptedAnswers[0] ?? ''));
        expect(new Set(options).size).toBe(options.length);
      }
      if (exercise.type === 'fill_blank' || exercise.type === 'select_word') expect(exercise.prompt).toContain('___');
      expect(exercise.explanation.pt.length).toBeGreaterThan(10);
      expect(exercise.explanation.en.length).toBeGreaterThan(10);
    },
  );

  it('referencia apenas vocabulário existente', () => {
    for (const lesson of LESSONS) {
      for (const id of lesson.vocabularyIds) expect(catalog.vocabularyEntry(id), `${lesson.id} → ${id}`).toBeDefined();
    }
  });

  it('conversa de prática de cada aula continua com perguntas de um assunto relacionado, sem repetir', () => {
    for (const lesson of LESSONS) {
      const practice = catalog.topic(`lesson:${lesson.id}`);
      expect(practice, lesson.id).toBeDefined();
      const questions = practice!.questions.map((question) => question.low);
      expect(questions[0]).toBe(lesson.practice.question);
      expect(questions.length, lesson.id).toBeGreaterThan(2);
      expect(new Set(questions).size).toBe(questions.length);
    }
    const routine = catalog.topic('lesson:simple-present')!.questions.map((question) => question.low);
    expect(routine.filter((question) => /wake up/i.test(question))).toHaveLength(1);
  });

  it('aponta temas de revisão para aulas existentes', () => {
    for (const lessonId of Object.values(SKILL_LESSON)) expect(catalog.lesson(lessonId as string)).toBeDefined();
  });

  it('tem respostas de nivelamento presentes nas alternativas', () => {
    for (const question of PLACEMENT_QUESTIONS) expect(question.options).toContain(question.answer);
  });

  it('gera exercícios de vocabulário com a tradução correta entre as opções', () => {
    const found = catalog.exercise('vocab:umbrella');
    expect(found?.exercise.options).toContain('guarda-chuva');
    expect(found?.exercise.acceptedAnswers).toEqual(['guarda-chuva']);
  });

  it('cria assuntos de prática a partir das aulas', () => {
    const topic = catalog.topic('lesson:verb-to-be');
    expect(topic?.title).toContain('Verbo to be');
    expect(CONVERSATION_TOPICS.length).toBeGreaterThanOrEqual(6);
  });
});
