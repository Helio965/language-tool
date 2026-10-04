/**
 * UC10 — Consultar vocabulário · RF08 (vocabulário por nível) · RF17 (vocabulário estudado).
 */
import type { VocabularyEntry } from '../../domain/content';
import type { UserVocabulary, VocabularyStatus } from '../../domain/entities';
import { AppError } from '../../domain/errors';
import { addDays } from '../../domain/review';
import { loadProfile, requireUser, type ServiceContext } from '../context';
import type { VocabularyItemView, VocabularyOverview } from '../views';

export function createVocabularyService(ctx: ServiceContext) {
  const lessonByWord = new Map<string, { id: string; title: string }>();
  for (const lesson of ctx.catalog.lessons()) {
    for (const id of lesson.vocabularyIds) if (!lessonByWord.has(id)) lessonByWord.set(id, { id: lesson.id, title: lesson.title });
  }

  function view(entry: VocabularyEntry, item: UserVocabulary | null): VocabularyItemView {
    const lesson = lessonByWord.get(entry.id) ?? null;
    return {
      ...entry,
      status: item?.status ?? null,
      timesReviewed: item?.timesReviewed ?? 0,
      nextReviewAt: item?.nextReviewAt ?? null,
      due: Boolean(item && item.status === 'learning' && Date.parse(item.nextReviewAt) <= ctx.now().getTime()),
      lessonId: lesson?.id ?? null,
      lessonTitle: lesson?.title ?? null,
    };
  }

  function requireEntry(id: string): VocabularyEntry {
    const entry = ctx.catalog.vocabularyEntry(id);
    if (!entry) throw new AppError('NOT_FOUND', 'Palavra não encontrada.');
    return entry;
  }

  return {
    async list(userId: string): Promise<VocabularyOverview> {
      await requireUser(ctx, userId);
      const profile = await loadProfile(ctx, userId);
      const items = await ctx.store.userVocabulary.listByUser(userId);
      const byId = new Map(items.map((item) => [item.vocabularyId, item]));
      const studied = items
        .map((item) => {
          const entry = ctx.catalog.vocabularyEntry(item.vocabularyId);
          return entry ? view(entry, item) : null;
        })
        .filter((item) => item !== null)
        .sort((a, b) => Number(b.due) - Number(a.due) || a.word.localeCompare(b.word));
      const level = profile.estimatedLevel ?? 'beginner';
      const suggestions = ctx.catalog
        .vocabulary()
        .filter((entry) => entry.level === level && !byId.has(entry.id))
        .slice(0, 6)
        .map((entry) => view(entry, null));
      return {
        studied,
        suggestions,
        counts: {
          studied: studied.length,
          learning: studied.filter((item) => item.status === 'learning').length,
          learned: studied.filter((item) => item.status === 'learned').length,
          due: studied.filter((item) => item.due).length,
        },
      };
    },

    async get(userId: string, vocabularyId: string): Promise<VocabularyItemView> {
      await requireUser(ctx, userId);
      const entry = requireEntry(vocabularyId);
      return view(entry, await ctx.store.userVocabulary.get(userId, vocabularyId));
    },

    /** Adiciona uma sugestão ao vocabulário estudado ou altera o status ("Já aprendi"). */
    async setStatus(userId: string, vocabularyId: string, status: VocabularyStatus): Promise<VocabularyItemView> {
      await requireUser(ctx, userId);
      const entry = requireEntry(vocabularyId);
      if (status !== 'learning' && status !== 'learned') throw new AppError('VALIDATION', 'Status inválido.');
      const now = ctx.now();
      const existing = await ctx.store.userVocabulary.get(userId, vocabularyId);
      const item: UserVocabulary = existing
        ? { ...existing, status, nextReviewAt: status === 'learning' ? now.toISOString() : existing.nextReviewAt }
        : {
            userId,
            vocabularyId,
            status,
            timesReviewed: 0,
            firstSeenAt: now.toISOString(),
            lastReviewedAt: null,
            nextReviewAt: addDays(now, 1).toISOString(),
          };
      await ctx.store.userVocabulary.save(item);
      return view(entry, item);
    },
  };
}

export type VocabularyService = ReturnType<typeof createVocabularyService>;
