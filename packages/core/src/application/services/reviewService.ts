/**
 * UC08 — Revisar conteúdo: identifica o que precisa de revisão, apresenta atividades,
 * corrige e atualiza o progresso.
 */
import { toPublicExercise } from '../../content/catalog';
import type { Exercise } from '../../domain/content';
import type { Review } from '../../domain/entities';
import { AppError } from '../../domain/errors';
import {
  addDays,
  dueVocabulary,
  intervalDays,
  planReviews,
  REVIEW_INTERVALS_DAYS,
  REVIEW_PASS_SCORE,
  REVIEW_REASON_PRIORITY,
  reviewReasonText,
  reviewTitle,
  scheduleWord,
} from '../../domain/review';
import { loadProfile, requireUser, type ServiceContext } from '../context';
import type { LearningService } from './learningService';
import type { ExerciseFeedback, ReviewItemView, ReviewQueueView, ReviewResult, ReviewSessionView } from '../views';

const MAX_SESSION_EXERCISES = 5;

export function createReviewService(ctx: ServiceContext, learning: LearningService) {
  async function requireOwned(userId: string, reviewId: string): Promise<Review> {
    const review = await ctx.store.reviews.get(reviewId);
    if (!review || review.userId !== userId) throw new AppError('NOT_FOUND', 'Revisão não encontrada.');
    return review;
  }

  async function itemView(userId: string, review: Review): Promise<ReviewItemView> {
    const lessons = ctx.catalog.lessons();
    const progress = review.kind === 'lesson' ? await ctx.store.progress.get(userId, review.refId) : null;
    const due = review.kind === 'vocabulary' ? dueVocabulary(await ctx.store.userVocabulary.listByUser(userId), ctx.now()).length : 0;
    return {
      id: review.id,
      kind: review.kind,
      reason: review.reason,
      title: reviewTitle(review, lessons),
      reasonText: reviewReasonText(review, { lessonScore: progress?.score ?? undefined, dueWords: due }),
      dueAt: review.dueAt,
      lessonId: review.kind === 'lesson' ? review.refId : null,
      estimatedMinutes: review.kind === 'vocabulary' ? 2 : 4,
    };
  }

  /** Cria novos itens conforme o desempenho recente (gatilhos simples e explicáveis). */
  async function refresh(userId: string): Promise<Review[]> {
    const now = ctx.now();
    const [profile, progress, vocabulary, existing] = await Promise.all([
      loadProfile(ctx, userId),
      ctx.store.progress.listByUser(userId),
      ctx.store.userVocabulary.listByUser(userId),
      ctx.store.reviews.listByUser(userId),
    ]);
    const planned = planReviews({ now, progress, difficulties: profile.difficulties, vocabulary, existing });
    const created: Review[] = planned.map((item) => ({
      id: ctx.id(),
      userId,
      kind: item.kind,
      refId: item.refId,
      reason: item.reason,
      status: 'pending',
      dueAt: item.dueAt,
      intervalStep: item.intervalStep,
      timesReviewed: 0,
      lastScore: null,
      timeSpentSeconds: 0,
      lastReviewedAt: null,
      createdAt: now.toISOString(),
    }));
    for (const review of created) await ctx.store.reviews.save(review);
    return [...existing, ...created];
  }

  async function sessionExercises(userId: string, review: Review): Promise<Exercise[]> {
    if (review.kind === 'vocabulary') {
      const due = dueVocabulary(await ctx.store.userVocabulary.listByUser(userId), ctx.now()).slice(0, 6);
      return due.map((item) => ctx.catalog.exercise(`vocab:${item.vocabularyId}`)?.exercise).filter((exercise) => exercise !== undefined);
    }
    const attempts = await ctx.store.attempts.listByUser(userId);
    const missed = new Set(attempts.filter((attempt) => !attempt.isCorrect).map((attempt) => attempt.exerciseId));
    const pool =
      review.kind === 'lesson'
        ? (ctx.catalog.lesson(review.refId)?.exercises ?? [])
        : ctx.catalog.lessons().flatMap((lesson) => lesson.exercises.filter((exercise) => exercise.skillTag === review.refId));
    // Prioriza exercícios que o usuário errou; exercícios abertos ficam para as aulas.
    return pool
      .filter((exercise) => exercise.type !== 'write')
      .sort((a, b) => Number(missed.has(b.id)) - Number(missed.has(a.id)))
      .slice(0, MAX_SESSION_EXERCISES);
  }

  return {
    async queue(userId: string): Promise<ReviewQueueView> {
      await requireUser(ctx, userId);
      const reviews = await refresh(userId);
      const nowIso = ctx.now().toISOString();
      const pending = reviews
        .filter((review) => review.status === 'pending')
        .sort((a, b) => REVIEW_REASON_PRIORITY[a.reason] - REVIEW_REASON_PRIORITY[b.reason] || a.dueAt.localeCompare(b.dueAt));
      const due = pending.filter((review) => review.dueAt <= nowIso);
      const upcoming = pending.filter((review) => review.dueAt > nowIso).slice(0, 5);
      return {
        due: await Promise.all(due.map((review) => itemView(userId, review))),
        upcoming: await Promise.all(upcoming.map((review) => itemView(userId, review))),
        completedCount: reviews.filter((review) => review.status === 'done').length,
      };
    },

    async startSession(userId: string, reviewId: string): Promise<ReviewSessionView> {
      const review = await requireOwned(userId, reviewId);
      const exercises = await sessionExercises(userId, review);
      if (!exercises.length) throw new AppError('NOT_FOUND', 'Não há atividades para esta revisão agora.');
      return { review: await itemView(userId, review), exercises: exercises.map(toPublicExercise) };
    },

    async answer(userId: string, reviewId: string, exerciseId: string, answer: string): Promise<ExerciseFeedback> {
      await requireOwned(userId, reviewId);
      const feedback = await learning.answer(userId, exerciseId, answer, 'review');
      if (exerciseId.startsWith('vocab:')) {
        const vocabularyId = exerciseId.slice('vocab:'.length);
        const item = await ctx.store.userVocabulary.get(userId, vocabularyId);
        if (item) await ctx.store.userVocabulary.save(scheduleWord(item, feedback.status === 'correct', ctx.now()));
      }
      return feedback;
    },

    async complete(userId: string, reviewId: string, result: { correct: number; total: number; timeSpentSeconds: number }): Promise<ReviewResult> {
      const review = await requireOwned(userId, reviewId);
      const total = Math.max(0, Math.floor(result.total));
      const correct = Math.max(0, Math.min(total, Math.floor(result.correct)));
      const score = total ? Math.round((correct / total) * 100) : 0;
      const now = ctx.now();
      const seconds = Math.max(0, Math.min(Math.round(Number(result.timeSpentSeconds) || 0), 60 * 60));
      await ctx.store.reviews.save({
        ...review,
        status: 'done',
        timesReviewed: review.timesReviewed + 1,
        lastScore: score,
        timeSpentSeconds: review.timeSpentSeconds + seconds,
        lastReviewedAt: now.toISOString(),
      });

      let nextReviewAt: string | null = null;
      if (review.kind !== 'vocabulary') {
        const passed = score >= REVIEW_PASS_SCORE;
        const nextStep = passed ? review.intervalStep + 1 : 0;
        if (!passed || nextStep < REVIEW_INTERVALS_DAYS.length) {
          nextReviewAt = addDays(now, passed ? intervalDays(nextStep) : 1).toISOString();
          await ctx.store.reviews.save({
            ...review,
            id: ctx.id(),
            reason: passed ? 'spaced' : review.reason,
            status: 'pending',
            dueAt: nextReviewAt,
            intervalStep: nextStep,
            timesReviewed: 0,
            lastScore: null,
            timeSpentSeconds: 0,
            lastReviewedAt: null,
            createdAt: now.toISOString(),
          });
        }
      }
      const message =
        score >= 80
          ? 'Excelente revisão! Esse conteúdo está ficando firme.'
          : score >= REVIEW_PASS_SCORE
            ? 'Boa revisão! Vamos rever mais uma vez daqui a alguns dias.'
            : 'Tudo bem errar na revisão — é assim que se aprende. Vamos rever amanhã.';
      return { reviewId, correct, total, score, nextReviewAt, message };
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
