/**
 * UC11 — Consultar progresso · Página inicial ("qual é a próxima coisa a fazer?").
 */
import { GOAL_LABELS } from '../../domain/profile';
import { LEVEL_LABELS } from '../../domain/levels';
import { computeProgress, type ConversationActivity } from '../../domain/progress';
import { firstName } from '../../domain/text';
import { loadPreferences, loadProfile, requireUser, type ServiceContext } from '../context';
import type { ConversationService } from './conversationService';
import type { LearningService } from './learningService';
import type { ReviewService } from './reviewService';
import type { VocabularyService } from './vocabularyService';
import type { HomeDashboard, ProgressOverview } from '../views';

export function createProgressService(
  ctx: ServiceContext,
  deps: { learning: LearningService; review: ReviewService; vocabulary: VocabularyService; conversation: ConversationService },
) {
  async function snapshot(userId: string) {
    const [profile, progress, attempts, vocabulary, reviews, conversations] = await Promise.all([
      loadProfile(ctx, userId),
      ctx.store.progress.listByUser(userId),
      ctx.store.attempts.listByUser(userId),
      ctx.store.userVocabulary.listByUser(userId),
      ctx.store.reviews.listByUser(userId),
      ctx.store.conversations.listByUser(userId),
    ]);
    const activity: ConversationActivity[] = conversations.map((conversation) => ({
      startedAt: conversation.createdAt,
      lastActivityAt: conversation.updatedAt,
      userMessages: conversation.userMessageCount,
      correctedSkills: conversation.correctedSkills,
    }));
    return {
      profile,
      progress,
      data: computeProgress({
        now: ctx.now(),
        timeZone: ctx.timeZone,
        estimatedLevel: profile.estimatedLevel,
        lessons: ctx.catalog.lessons(),
        progress,
        attempts,
        vocabulary,
        reviews,
        conversations: activity,
      }),
    };
  }

  return {
    async overview(userId: string): Promise<ProgressOverview> {
      await requireUser(ctx, userId);
      const { data, progress } = await snapshot(userId);
      const queue = await deps.review.queue(userId);
      const recentLessons = progress
        .filter((record) => record.status === 'completed' && record.completedAt)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        .slice(0, 5)
        .map((record) => ({
          lessonId: record.lessonId,
          title: ctx.catalog.lesson(record.lessonId)?.title ?? record.lessonId,
          score: record.score,
          completedAt: record.completedAt ?? record.updatedAt,
        }));
      return { ...data, needsReview: queue.due.slice(0, 5), recentLessons };
    },

    async home(userId: string): Promise<HomeDashboard> {
      const user = await requireUser(ctx, userId);
      const [{ data, profile }, preferences, lessons, queue, vocabulary, conversations] = await Promise.all([
        snapshot(userId),
        loadPreferences(ctx, userId),
        deps.learning.listLessons(userId),
        deps.review.queue(userId),
        deps.vocabulary.list(userId),
        deps.conversation.list(userId),
      ]);
      const continueLesson = lessons.find((lesson) => lesson.recommended) ?? null;
      const recentWords = [...vocabulary.studied]
        .sort((a, b) => (b.nextReviewAt ?? '').localeCompare(a.nextReviewAt ?? ''))
        .slice(0, 4);
      return {
        firstName: firstName(user.name),
        level: profile.estimatedLevel,
        levelLabel: profile.estimatedLevel ? LEVEL_LABELS[profile.estimatedLevel] : null,
        goal: profile.goal,
        goalLabel: profile.goal ? GOAL_LABELS[profile.goal] : null,
        continueLesson,
        reviewCount: queue.due.length,
        reviewDue: queue.due.slice(0, 3),
        recentWords,
        streakDays: data.totals.streakDays,
        todayMinutes: data.todayMinutes,
        dailyGoalMinutes: preferences.dailyGoalMinutes,
        lessonsCompleted: data.totals.lessonsCompleted,
        accuracy: data.totals.accuracy,
        lastConversation: conversations[0] ?? null,
        hasActivity: data.hasActivity,
      };
    },
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
