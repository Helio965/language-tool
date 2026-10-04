/**
 * Revisão (RF18, UC08). Algoritmo propositalmente simples para o MVP:
 * gatilhos claros (erros, nota baixa, conversa, vocabulário vencido) + intervalos fixos
 * de revisão espaçada. Cada item guarda o MOTIVO, exibido ao usuário.
 */
import type { Lesson } from './content';
import type { Progress, Review, ReviewKind, ReviewReason, UserVocabulary } from './entities';
import { SKILL_LABELS, type SkillTag } from './skills';

/** Intervalos (em dias) da revisão espaçada. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const LOW_SCORE_THRESHOLD = 70;
export const REVIEW_PASS_SCORE = 60;

export const REVIEW_REASON_PRIORITY: Record<ReviewReason, number> = {
  errors: 0,
  conversation: 1,
  low_score: 2,
  vocabulary_due: 3,
  spaced: 4,
};

export interface NewReview {
  kind: ReviewKind;
  refId: string;
  reason: ReviewReason;
  dueAt: string;
  intervalStep: number;
}

export interface ReviewPlanInput {
  now: Date;
  progress: Progress[];
  difficulties: SkillTag[];
  vocabulary: UserVocabulary[];
  existing: Review[];
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function intervalDays(step: number): number {
  return REVIEW_INTERVALS_DAYS[Math.min(step, REVIEW_INTERVALS_DAYS.length - 1)] ?? 1;
}

function hasPending(existing: Review[], kind: ReviewKind, refId: string): boolean {
  return existing.some((review) => review.status === 'pending' && review.kind === kind && review.refId === refId);
}

export function dueVocabulary(vocabulary: UserVocabulary[], now: Date): UserVocabulary[] {
  return vocabulary.filter((item) => item.status === 'learning' && Date.parse(item.nextReviewAt) <= now.getTime());
}

/** Decide quais novos itens de revisão devem ser criados. */
export function planReviews({ now, progress, difficulties, vocabulary, existing }: ReviewPlanInput): NewReview[] {
  const nowIso = now.toISOString();
  const planned: NewReview[] = [];
  const pendingOrPlanned = (kind: ReviewKind, refId: string) =>
    hasPending(existing, kind, refId) || planned.some((item) => item.kind === kind && item.refId === refId);

  for (const tag of difficulties) {
    if (!pendingOrPlanned('skill', tag)) planned.push({ kind: 'skill', refId: tag, reason: 'errors', dueAt: nowIso, intervalStep: 0 });
  }

  for (const record of progress) {
    if (record.status !== 'completed' || !record.completedAt) continue;
    if (pendingOrPlanned('lesson', record.lessonId)) continue;
    if (record.score < LOW_SCORE_THRESHOLD) {
      planned.push({ kind: 'lesson', refId: record.lessonId, reason: 'low_score', dueAt: nowIso, intervalStep: 0 });
      continue;
    }
    const everReviewed = existing.some((review) => review.kind === 'lesson' && review.refId === record.lessonId);
    if (!everReviewed) {
      const due = addDays(new Date(record.completedAt), intervalDays(0));
      planned.push({ kind: 'lesson', refId: record.lessonId, reason: 'spaced', dueAt: due.toISOString(), intervalStep: 0 });
    }
  }

  if (dueVocabulary(vocabulary, now).length > 0 && !pendingOrPlanned('vocabulary', 'vocabulary')) {
    planned.push({ kind: 'vocabulary', refId: 'vocabulary', reason: 'vocabulary_due', dueAt: nowIso, intervalStep: 0 });
  }
  return planned;
}

export function reviewTitle(review: Pick<Review, 'kind' | 'refId'>, lessons: readonly Lesson[]): string {
  if (review.kind === 'lesson') return lessons.find((lesson) => lesson.id === review.refId)?.title ?? 'Aula';
  if (review.kind === 'skill') return SKILL_LABELS[review.refId as SkillTag] ?? review.refId;
  return 'Vocabulário';
}

export function reviewReasonText(
  review: Pick<Review, 'kind' | 'refId' | 'reason' | 'lastScore'>,
  context: { lessonScore?: number; dueWords?: number },
): string {
  switch (review.reason) {
    case 'errors':
      return `Você teve dificuldade com ${SKILL_LABELS[review.refId as SkillTag] ?? 'este tema'} nos últimos exercícios.`;
    case 'conversation':
      return 'Este ponto apareceu nas correções das suas conversas recentes.';
    case 'low_score':
      return `Você acertou ${context.lessonScore ?? review.lastScore ?? 0}% nesta aula. Uma revisão rápida ajuda a fixar.`;
    case 'vocabulary_due':
      return `${context.dueWords ?? 0} ${context.dueWords === 1 ? 'palavra está pronta' : 'palavras estão prontas'} para revisão.`;
    case 'spaced':
      return 'Revisar alguns dias depois de estudar ajuda a memorizar por mais tempo.';
  }
}

/** Próxima data de revisão de uma palavra conforme o resultado. */
export function scheduleWord(item: UserVocabulary, correct: boolean, now: Date): UserVocabulary {
  const timesReviewed = item.timesReviewed + 1;
  if (!correct) {
    return { ...item, status: 'learning', timesReviewed, lastReviewedAt: now.toISOString(), nextReviewAt: addDays(now, 1).toISOString() };
  }
  const learned = timesReviewed >= 3;
  return {
    ...item,
    status: learned ? 'learned' : 'learning',
    timesReviewed,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, intervalDays(timesReviewed)).toISOString(),
  };
}
