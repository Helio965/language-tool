/**
 * Modo Aprender — UC05 (Iniciar aula), UC06 (Realizar exercício), UC07 (Consultar correção).
 * Fluxo: Aula → Explicação → Exemplos → Exercício → Correção → Explicação do erro → Revisão → Próxima aula.
 */
import { buildCorrection } from '../../ai/grammar/checker';
import { selectLearningCorrections } from '../../ai/correctionPolicy';
import { adaptBilingual, policyFor } from '../../ai/levelPolicy';
import { LESSON_PRACTICE_PREFIX } from '../../content/topics';
import { toPublicExercise } from '../../content/catalog';
import type { Example, Exercise, Lesson } from '../../domain/content';
import type { AttemptContext, Progress } from '../../domain/entities';
import { AppError } from '../../domain/errors';
import { checkWriteRequirements, feedbackTitle, gradeClosedExercise, type GradeStatus } from '../../domain/grading';
import { LEVEL_LABELS, levelIndex, type Level } from '../../domain/levels';
import { computeDifficulties, shouldLevelUp } from '../../domain/progress';
import { addDays } from '../../domain/review';
import { ANSWER_MAX } from '../../domain/validation';
import { loadLearner, loadProfile, requireUser, type LearnerBundle, type ServiceContext } from '../context';
import type { ExerciseFeedback, LessonResult, LessonStatus, LessonSummary, LessonView } from '../views';

export function recommendLesson(lessons: readonly Lesson[], progress: Progress[], level: Level): Lesson | null {
  const inProgress = lessons.find((lesson) => progress.some((p) => p.lessonId === lesson.id && p.status === 'in_progress'));
  if (inProgress) return inProgress;
  const notCompleted = lessons.filter((lesson) => !progress.some((p) => p.lessonId === lesson.id && p.status === 'completed'));
  return (
    notCompleted.find((lesson) => lesson.level === level) ??
    notCompleted.find((lesson) => levelIndex(lesson.level) > levelIndex(level)) ??
    notCompleted[0] ??
    null
  );
}

function summarize(lesson: Lesson, progress: Progress[], level: Level, recommendedId: string | null): LessonSummary {
  const record = progress.find((p) => p.lessonId === lesson.id);
  const status: LessonStatus = record?.status === 'completed' ? 'completed' : record ? 'in_progress' : 'available';
  return {
    id: lesson.id,
    title: lesson.title,
    topic: lesson.topic,
    level: lesson.level,
    order: lesson.order,
    summary: lesson.summary,
    estimatedMinutes: lesson.estimatedMinutes,
    exerciseCount: lesson.exercises.length,
    status,
    score: record?.status === 'completed' ? record.score : null,
    recommended: lesson.id === recommendedId,
    aboveLevel: levelIndex(lesson.level) > levelIndex(level),
  };
}

export function createLearningService(ctx: ServiceContext) {
  function requireLesson(lessonId: string): Lesson {
    const lesson = ctx.catalog.lesson(lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 'Aula não encontrada.');
    return lesson;
  }

  async function listLessons(userId: string): Promise<LessonSummary[]> {
    const profile = await loadProfile(ctx, userId);
    const level = profile.estimatedLevel ?? 'beginner';
    const progress = await ctx.store.progress.listByUser(userId);
    const lessons = ctx.catalog.lessons();
    const recommended = recommendLesson(lessons, progress, level);
    return lessons.map((lesson) => summarize(lesson, progress, level, recommended?.id ?? null));
  }

  async function updateDifficulties(userId: string): Promise<void> {
    const [profile, attempts] = await Promise.all([loadProfile(ctx, userId), ctx.store.attempts.listByUser(userId)]);
    const difficulties = computeDifficulties(attempts);
    if (difficulties.join() !== profile.difficulties.join()) {
      await ctx.store.profiles.save({ ...profile, difficulties, updatedAt: ctx.now().toISOString() });
    }
  }

  /** Correção de um exercício com explicação adaptada ao nível (RF10, RF11, RN05). */
  async function gradeExercise(
    bundle: LearnerBundle,
    exercise: Exercise,
    answer: string,
    attemptNumber: number,
  ): Promise<{ status: GradeStatus; feedback: ExerciseFeedback }> {
    const { learner, preferences } = bundle;
    const language = learner.explanationLanguage;
    const policy = policyFor(learner.level);
    const includeTip = policy.includeTipByDefault || preferences.correctionIntensity === 'detailed';
    const explanation = adaptBilingual(exercise.explanation, language);
    const tip = includeTip && exercise.explanation.tip ? exercise.explanation.tip[language] : null;

    if (exercise.type === 'write') {
      const requirement = checkWriteRequirements(exercise, answer);
      if (!requirement.ok) {
        return {
          status: 'incorrect',
          feedback: {
            exerciseId: exercise.id,
            status: 'incorrect',
            title: 'Quase lá!',
            userAnswer: answer,
            expectedAnswer: null,
            explanation: requirement.message ?? explanation.primary,
            supportExplanation: explanation.primary,
            tip,
            correction: null,
            aiFeedback: null,
          },
        };
      }
      const review = await ctx.ai.correct({ learner, exercise, answer });
      const issues = selectLearningCorrections(review.issues, preferences.correctionIntensity);
      const blocking = issues.filter((issue) => issue.severity !== 'naturalness');
      const status: GradeStatus = blocking.length ? 'incorrect' : 'correct';
      const correction = buildCorrection(answer, issues, language, includeTip);
      return {
        status,
        feedback: {
          exerciseId: exercise.id,
          status,
          title: status === 'correct' ? feedbackTitle('correct', attemptNumber) : 'Vamos ajustar',
          userAnswer: answer,
          expectedAnswer: correction?.suggestion ?? null,
          explanation: correction?.explanation ?? explanation.primary,
          supportExplanation: policy.offerSupportLanguage ? explanation.support : null,
          tip: correction?.tip ?? tip,
          correction,
          aiFeedback: review.feedback,
        },
      };
    }

    const result = gradeClosedExercise(exercise, answer);
    const almostNote = language === 'pt' ? 'Confira a grafia: ' : 'Check the spelling: ';
    return {
      status: result.status,
      feedback: {
        exerciseId: exercise.id,
        status: result.status,
        title: feedbackTitle(result.status, attemptNumber),
        userAnswer: answer,
        expectedAnswer: result.expected,
        explanation: result.status === 'almost' ? `${almostNote}"${result.expected ?? ''}". ${explanation.primary}` : explanation.primary,
        supportExplanation: policy.offerSupportLanguage ? explanation.support : null,
        tip,
        correction: null,
        aiFeedback: null,
      },
    };
  }

  /** Registra a tentativa e devolve o feedback — usado por aulas e revisões. */
  async function answer(userId: string, exerciseId: string, rawAnswer: string, context: AttemptContext): Promise<ExerciseFeedback> {
    const bundle = await loadLearner(ctx, userId);
    const found = ctx.catalog.exercise(exerciseId);
    if (!found) throw new AppError('NOT_FOUND', 'Exercício não encontrado.');
    const answerText = String(rawAnswer ?? '').trim();
    if (!answerText) throw new AppError('VALIDATION', 'Resposta vazia.', { answer: 'Escreva ou escolha uma resposta.' });
    if (answerText.length > ANSWER_MAX) {
      throw new AppError('VALIDATION', 'Resposta muito longa.', { answer: `Use no máximo ${ANSWER_MAX} caracteres.` });
    }
    const attempts = await ctx.store.attempts.listByUser(userId);
    const { status, feedback } = await gradeExercise(bundle, found.exercise, answerText, attempts.length);
    await ctx.store.attempts.add({
      id: ctx.id(),
      userId,
      exerciseId: found.exercise.id,
      lessonId: found.lesson?.id ?? null,
      skillTag: found.exercise.skillTag,
      context,
      answer: answerText,
      isCorrect: status === 'correct',
      createdAt: ctx.now().toISOString(),
    });
    await updateDifficulties(userId);
    return feedback;
  }

  return {
    listLessons,
    answer,

    async getLesson(userId: string, lessonId: string): Promise<LessonView> {
      const lesson = requireLesson(lessonId);
      const { profile, learner } = await loadLearner(ctx, userId);
      const level = profile.estimatedLevel ?? 'beginner';
      const progress = await ctx.store.progress.listByUser(userId);
      const recommended = recommendLesson(ctx.catalog.lessons(), progress, level);
      const language = learner.explanationLanguage;
      return {
        ...summarize(lesson, progress, level, recommended?.id ?? null),
        objectives: lesson.objectives,
        language,
        supportLanguageAvailable: policyFor(level).offerSupportLanguage,
        explanation: lesson.explanation.map((paragraph) => adaptBilingual(paragraph, language)),
        table: lesson.table ?? null,
        examples: lesson.examples,
        vocabulary: lesson.vocabularyIds.map((id) => ctx.catalog.vocabularyEntry(id)).filter((entry) => entry !== undefined),
        exercises: lesson.exercises.map(toPublicExercise),
        practiceTopicId: `${LESSON_PRACTICE_PREFIX}${lesson.id}`,
        takeaways: lesson.takeaways,
      };
    },

    /** Marca o início (ou recomeço) de uma aula. Não apaga a conclusão anterior. */
    async startLesson(userId: string, lessonId: string): Promise<void> {
      await requireUser(ctx, userId);
      requireLesson(lessonId);
      const now = ctx.now().toISOString();
      const existing = await ctx.store.progress.get(userId, lessonId);
      await ctx.store.progress.save(
        existing
          ? { ...existing, startedAt: now, updatedAt: now }
          : {
              userId,
              lessonId,
              status: 'in_progress',
              correctCount: 0,
              totalCount: 0,
              score: 0,
              timeSpentSeconds: 0,
              startedAt: now,
              completedAt: null,
              updatedAt: now,
            },
      );
    },

    async checkAnswer(userId: string, lessonId: string, exerciseId: string, rawAnswer: string): Promise<ExerciseFeedback> {
      const lesson = requireLesson(lessonId);
      if (!lesson.exercises.some((exercise) => exercise.id === exerciseId)) throw new AppError('NOT_FOUND', 'Exercício não encontrado.');
      return answer(userId, exerciseId, rawAnswer, 'lesson');
    },

    async completeLesson(userId: string, lessonId: string, timeSpentSeconds: number): Promise<LessonResult> {
      const lesson = requireLesson(lessonId);
      await requireUser(ctx, userId);
      const now = ctx.now();
      const existing = await ctx.store.progress.get(userId, lessonId);
      const startedAt = existing?.startedAt ?? now.toISOString();
      const attempts = (await ctx.store.attempts.listByUser(userId))
        .filter((attempt) => attempt.lessonId === lessonId && attempt.context === 'lesson' && attempt.createdAt >= startedAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      // Conta a primeira tentativa de cada exercício nesta passagem pela aula.
      const firstAttempts = new Map<string, boolean>();
      for (const attempt of attempts) if (!firstAttempts.has(attempt.exerciseId)) firstAttempts.set(attempt.exerciseId, attempt.isCorrect);
      const total = lesson.exercises.length;
      const correct = [...firstAttempts.values()].filter(Boolean).length;
      const score = total ? Math.round((correct / total) * 100) : 100;
      const seconds = Math.max(0, Math.min(Math.round(Number(timeSpentSeconds) || 0), 3 * 60 * 60));

      await ctx.store.progress.save({
        userId,
        lessonId,
        status: 'completed',
        correctCount: correct,
        totalCount: total,
        score,
        timeSpentSeconds: (existing?.timeSpentSeconds ?? 0) + seconds,
        startedAt,
        completedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      // Vocabulário da aula passa a fazer parte do vocabulário estudado (RF17).
      const newWords = [];
      for (const vocabularyId of lesson.vocabularyIds) {
        const entry = ctx.catalog.vocabularyEntry(vocabularyId);
        if (!entry) continue;
        if (!(await ctx.store.userVocabulary.get(userId, vocabularyId))) {
          await ctx.store.userVocabulary.save({
            userId,
            vocabularyId,
            status: 'learning',
            timesReviewed: 0,
            firstSeenAt: now.toISOString(),
            lastReviewedAt: null,
            nextReviewAt: addDays(now, 1).toISOString(),
          });
          newWords.push(entry);
        }
      }

      const profile = await loadProfile(ctx, userId);
      const level = profile.estimatedLevel ?? 'beginner';
      const progress = await ctx.store.progress.listByUser(userId);
      const promoted = shouldLevelUp(level, ctx.catalog.lessons(), progress);
      if (promoted) {
        await ctx.store.profiles.save({ ...profile, estimatedLevel: promoted, updatedAt: now.toISOString() });
      }
      const effectiveLevel = promoted ?? level;
      const next = recommendLesson(ctx.catalog.lessons(), progress, effectiveLevel);

      return {
        lessonId,
        correct,
        total,
        score,
        timeSpentSeconds: seconds,
        newWords,
        levelUp: promoted ? { level: promoted, label: LEVEL_LABELS[promoted] } : null,
        nextLesson: next ? summarize(next, progress, effectiveLevel, next.id) : null,
        takeaways: lesson.takeaways,
        practiceTopicId: `${LESSON_PRACTICE_PREFIX}${lesson.id}`,
        reviewSuggested: score < 70,
      };
    },

    /** "Explicar de outro jeito". */
    async explainAgain(userId: string, lessonId: string, attempt: number): Promise<{ text: string; language: 'pt' | 'en' }> {
      const lesson = requireLesson(lessonId);
      const { learner } = await loadLearner(ctx, userId);
      const text = await ctx.ai.explain({ learner, lesson, style: 'another_way', attempt: Math.max(0, Math.floor(attempt)) });
      return { text, language: learner.explanationLanguage };
    },

    /** "Me dê outro exemplo". */
    async anotherExample(userId: string, lessonId: string, attempt: number): Promise<Example> {
      const lesson = requireLesson(lessonId);
      const { learner } = await loadLearner(ctx, userId);
      return ctx.ai.anotherExample({ learner, lesson, attempt: Math.max(0, Math.floor(attempt)) });
    },
  };
}

export type LearningService = ReturnType<typeof createLearningService>;
