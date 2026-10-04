/**
 * Indicadores de progresso (RF16, UC11, Análise de requisitos §17).
 * Calculados a partir dos registros — sem armazenar agregados no MVP.
 * Apresentação simples: poucos números claros, sem painéis complexos.
 */
import type { Lesson } from './content';
import type { ExerciseAttempt, Progress, Review, UserVocabulary } from './entities';
import { LEVEL_LABELS, levelIndex, nextLevel, type Level } from './levels';
import { SKILL_LABELS, SKILL_LESSON, type SkillTag } from './skills';

export interface ConversationActivity {
  startedAt: string;
  lastActivityAt: string;
  userMessages: number;
  /** Temas corrigidos durante a conversa (para erros recorrentes). */
  correctedSkills: SkillTag[];
}

export interface DayActivity {
  date: string;
  weekday: string;
  minutes: number;
  active: boolean;
}

export interface SkillPerformance {
  skillTag: SkillTag;
  label: string;
  attempts: number;
  accuracy: number;
}

export interface RecurringError {
  skillTag: SkillTag;
  label: string;
  count: number;
  lessonId: string | null;
}

export interface LevelProgress {
  level: Level;
  label: string;
  nextLevel: Level | null;
  nextLabel: string | null;
  completedInLevel: number;
  totalInLevel: number;
  percent: number;
}

export interface ProgressTotals {
  lessonsCompleted: number;
  exercisesDone: number;
  accuracy: number | null;
  wordsStudied: number;
  wordsLearned: number;
  reviewsCompleted: number;
  conversations: number;
  studyDays: number;
  streakDays: number;
  studyMinutes: number;
}

export interface ProgressSnapshot {
  hasActivity: boolean;
  level: LevelProgress | null;
  totals: ProgressTotals;
  week: DayActivity[];
  todayMinutes: number;
  skills: SkillPerformance[];
  recurringErrors: RecurringError[];
}

export interface ProgressInput {
  now: Date;
  timeZone: string;
  estimatedLevel: Level | null;
  lessons: readonly Lesson[];
  progress: Progress[];
  attempts: ExerciseAttempt[];
  vocabulary: UserVocabulary[];
  reviews: Review[];
  conversations: ConversationActivity[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_CONVERSATION_SECONDS = 30 * 60;

export function localDate(iso: string | Date, timeZone: string): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function conversationSeconds(activity: ConversationActivity): number {
  if (activity.userMessages === 0) return 0;
  const elapsed = (Date.parse(activity.lastActivityAt) - Date.parse(activity.startedAt)) / 1000;
  return Math.min(MAX_CONVERSATION_SECONDS, Math.max(60, elapsed));
}

/** Sequência de dias consecutivos com estudo, terminando hoje ou ontem. */
export function computeStreak(activeDates: Set<string>, today: string): number {
  let cursor = activeDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Temas com erros recorrentes nas tentativas recentes (alimenta perfil e revisão). */
export function computeDifficulties(attempts: ExerciseAttempt[], window = 20): SkillTag[] {
  const recent = attempts
    .filter((attempt) => attempt.context !== 'placement')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, window);
  const stats = new Map<SkillTag, { total: number; errors: number }>();
  for (const attempt of recent) {
    const entry = stats.get(attempt.skillTag) ?? { total: 0, errors: 0 };
    entry.total++;
    if (!attempt.isCorrect) entry.errors++;
    stats.set(attempt.skillTag, entry);
  }
  return [...stats.entries()]
    .filter(([, { total, errors }]) => errors >= 2 && errors / total > 0.3)
    .sort((a, b) => b[1].errors - a[1].errors)
    .map(([tag]) => tag);
}

export function computeProgress(input: ProgressInput): ProgressSnapshot {
  const { now, timeZone } = input;
  const today = localDate(now, timeZone);
  const minutesByDay = new Map<string, number>();
  const activeDays = new Set<string>();
  const addActivity = (iso: string, seconds: number) => {
    const day = localDate(iso, timeZone);
    activeDays.add(day);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + seconds / 60);
  };

  for (const record of input.progress) addActivity(record.completedAt ?? record.updatedAt, record.timeSpentSeconds);
  for (const review of input.reviews) if (review.lastReviewedAt) addActivity(review.lastReviewedAt, review.timeSpentSeconds);
  for (const conversation of input.conversations) {
    if (conversation.userMessages > 0) addActivity(conversation.startedAt, conversationSeconds(conversation));
  }
  const practiceAttempts = input.attempts.filter((attempt) => attempt.context !== 'placement');
  for (const attempt of practiceAttempts) activeDays.add(localDate(attempt.createdAt, timeZone));

  const studySeconds =
    input.progress.reduce((sum, record) => sum + record.timeSpentSeconds, 0) +
    input.reviews.reduce((sum, review) => sum + review.timeSpentSeconds, 0) +
    input.conversations.reduce((sum, conversation) => sum + conversationSeconds(conversation), 0);

  const correct = practiceAttempts.filter((attempt) => attempt.isCorrect).length;
  const completedIds = new Set(input.progress.filter((record) => record.status === 'completed').map((record) => record.lessonId));

  const week: DayActivity[] = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(today, index - 6);
    const minutes = Math.round(minutesByDay.get(date) ?? 0);
    return { date, weekday: WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? '', minutes, active: activeDays.has(date) };
  });

  const skillStats = new Map<SkillTag, { total: number; correct: number }>();
  for (const attempt of practiceAttempts) {
    const entry = skillStats.get(attempt.skillTag) ?? { total: 0, correct: 0 };
    entry.total++;
    if (attempt.isCorrect) entry.correct++;
    skillStats.set(attempt.skillTag, entry);
  }
  const skills = [...skillStats.entries()]
    .map(([skillTag, stats]) => ({
      skillTag,
      label: SKILL_LABELS[skillTag],
      attempts: stats.total,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 6);

  const errorCounts = new Map<SkillTag, number>();
  for (const attempt of practiceAttempts.slice(-40)) {
    if (!attempt.isCorrect) errorCounts.set(attempt.skillTag, (errorCounts.get(attempt.skillTag) ?? 0) + 1);
  }
  for (const conversation of input.conversations) {
    for (const tag of conversation.correctedSkills) errorCounts.set(tag, (errorCounts.get(tag) ?? 0) + 1);
  }
  const recurringErrors = [...errorCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([skillTag, count]) => ({ skillTag, label: SKILL_LABELS[skillTag], count, lessonId: SKILL_LESSON[skillTag] ?? null }));

  let level: LevelProgress | null = null;
  if (input.estimatedLevel) {
    const inLevel = input.lessons.filter((lesson) => lesson.level === input.estimatedLevel);
    const completedInLevel = inLevel.filter((lesson) => completedIds.has(lesson.id)).length;
    const next = nextLevel(input.estimatedLevel);
    level = {
      level: input.estimatedLevel,
      label: LEVEL_LABELS[input.estimatedLevel],
      nextLevel: next,
      nextLabel: next ? LEVEL_LABELS[next] : null,
      completedInLevel,
      totalInLevel: inLevel.length,
      percent: inLevel.length ? Math.round((completedInLevel / inLevel.length) * 100) : 100,
    };
  }

  const totals: ProgressTotals = {
    lessonsCompleted: completedIds.size,
    exercisesDone: practiceAttempts.length,
    accuracy: practiceAttempts.length ? Math.round((correct / practiceAttempts.length) * 100) : null,
    wordsStudied: input.vocabulary.length,
    wordsLearned: input.vocabulary.filter((item) => item.status === 'learned').length,
    reviewsCompleted: input.reviews.filter((review) => review.status === 'done').length,
    conversations: input.conversations.filter((conversation) => conversation.userMessages > 0).length,
    studyDays: activeDays.size,
    streakDays: computeStreak(activeDays, today),
    studyMinutes: Math.round(studySeconds / 60),
  };

  return {
    hasActivity: totals.exercisesDone > 0 || totals.conversations > 0 || totals.lessonsCompleted > 0,
    level,
    totals,
    week,
    todayMinutes: Math.round(minutesByDay.get(today) ?? 0),
    skills,
    recurringErrors,
  };
}

/**
 * Evolução estimada de nível: ao concluir todas as aulas do nível atual com média ≥ 70%,
 * o nível estimado avança. Regra simples e transparente para o usuário.
 */
export const LEVEL_UP_MIN_AVERAGE = 70;

export function shouldLevelUp(level: Level, lessons: readonly Lesson[], progress: Progress[]): Level | null {
  const next = nextLevel(level);
  if (!next) return null;
  const inLevel = lessons.filter((lesson) => lesson.level === level);
  if (!inLevel.length) return null;
  const records = inLevel.map((lesson) => progress.find((record) => record.lessonId === lesson.id && record.status === 'completed'));
  if (records.some((record) => !record)) return null;
  const average = records.reduce((sum, record) => sum + (record?.score ?? 0), 0) / records.length;
  return average >= LEVEL_UP_MIN_AVERAGE && levelIndex(next) > levelIndex(level) ? next : null;
}
