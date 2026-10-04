/**
 * Implementação SQLite das portas de persistência do core (application/ports.ts).
 * Conversões: booleanos ↔ 0/1, listas/objetos ↔ JSON, snake_case ↔ camelCase.
 */
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type {
  Conversation,
  DataStore,
  ExerciseAttempt,
  LearningProfile,
  Message,
  PasswordResetToken,
  Preferences,
  Progress,
  Review,
  UserRecord,
  UserVocabulary,
} from '@english-ai/core';
import { transaction } from '../db/database';

type Cell = SQLInputValue | undefined;
type Row = Record<string, Cell>;
type Params = Record<string, SQLInputValue>;

const json = (value: unknown): string => JSON.stringify(value);
const parse = <T>(value: Cell): T => JSON.parse(String(value ?? 'null')) as T;
const bool = (value: boolean): number => (value ? 1 : 0);
const str = (value: Cell): string => String(value);
const strOrNull = (value: Cell): string | null => (value === null || value === undefined ? null : String(value));
const num = (value: Cell): number => Number(value);
const numOrNull = (value: Cell): number | null => (value === null || value === undefined ? null : Number(value));

const toUser = (r: Row): UserRecord => ({
  id: str(r.id),
  name: str(r.name),
  email: str(r.email),
  passwordHash: str(r.password_hash),
  role: str(r.role) as UserRecord['role'],
  createdAt: str(r.created_at),
  termsAcceptedAt: str(r.terms_accepted_at),
  sessionVersion: num(r.session_version ?? 0),
});

const toPasswordReset = (r: Row): PasswordResetToken => ({
  id: str(r.id),
  userId: str(r.user_id),
  tokenHash: str(r.token_hash),
  createdAt: str(r.created_at),
  expiresAt: str(r.expires_at),
  usedAt: strOrNull(r.used_at),
});

const toProfile = (r: Row): LearningProfile => ({
  userId: str(r.user_id),
  goal: strOrNull(r.goal) as LearningProfile['goal'],
  perceivedLevel: str(r.perceived_level) as LearningProfile['perceivedLevel'],
  priorExperience: strOrNull(r.prior_experience) as LearningProfile['priorExperience'],
  conversationInterest: num(r.conversation_interest) === 1,
  professionalInterest: num(r.professional_interest) === 1,
  interestAreas: parse(r.interest_areas),
  estimatedLevel: strOrNull(r.estimated_level) as LearningProfile['estimatedLevel'],
  placementScore: numOrNull(r.placement_score),
  placementCompletedAt: strOrNull(r.placement_completed_at),
  onboardingCompletedAt: strOrNull(r.onboarding_completed_at),
  difficulties: parse(r.difficulties),
  updatedAt: str(r.updated_at),
});

const toPreferences = (r: Row): Preferences => ({
  userId: str(r.user_id),
  explanationLanguage: str(r.explanation_language) as Preferences['explanationLanguage'],
  correctionIntensity: str(r.correction_intensity) as Preferences['correctionIntensity'],
  replyLength: str(r.reply_length) as Preferences['replyLength'],
  showTranslations: num(r.show_translations) === 1,
  saveConversationHistory: num(r.save_conversation_history) === 1,
  studyReminders: num(r.study_reminders) === 1,
  dailyGoalMinutes: num(r.daily_goal_minutes),
  updatedAt: str(r.updated_at),
});

const toProgress = (r: Row): Progress => ({
  userId: str(r.user_id),
  lessonId: str(r.lesson_id),
  status: str(r.status) as Progress['status'],
  correctCount: num(r.correct_count),
  totalCount: num(r.total_count),
  score: num(r.score),
  timeSpentSeconds: num(r.time_spent_seconds),
  startedAt: str(r.started_at),
  completedAt: strOrNull(r.completed_at),
  updatedAt: str(r.updated_at),
});

const toAttempt = (r: Row): ExerciseAttempt => ({
  id: str(r.id),
  userId: str(r.user_id),
  exerciseId: str(r.exercise_id),
  lessonId: strOrNull(r.lesson_id),
  skillTag: str(r.skill_tag) as ExerciseAttempt['skillTag'],
  context: str(r.context) as ExerciseAttempt['context'],
  answer: str(r.answer),
  isCorrect: num(r.is_correct) === 1,
  createdAt: str(r.created_at),
});

const toUserVocabulary = (r: Row): UserVocabulary => ({
  userId: str(r.user_id),
  vocabularyId: str(r.vocabulary_id),
  status: str(r.status) as UserVocabulary['status'],
  timesReviewed: num(r.times_reviewed),
  firstSeenAt: str(r.first_seen_at),
  lastReviewedAt: strOrNull(r.last_reviewed_at),
  nextReviewAt: str(r.next_review_at),
});

const toReview = (r: Row): Review => ({
  id: str(r.id),
  userId: str(r.user_id),
  kind: str(r.kind) as Review['kind'],
  refId: str(r.ref_id),
  reason: str(r.reason) as Review['reason'],
  status: str(r.status) as Review['status'],
  dueAt: str(r.due_at),
  intervalStep: num(r.interval_step),
  timesReviewed: num(r.times_reviewed),
  lastScore: numOrNull(r.last_score),
  timeSpentSeconds: num(r.time_spent_seconds),
  lastReviewedAt: strOrNull(r.last_reviewed_at),
  createdAt: str(r.created_at),
});

const toConversation = (r: Row): Conversation => ({
  id: str(r.id),
  userId: str(r.user_id),
  topicId: str(r.topic_id),
  title: str(r.title),
  levelAtStart: str(r.level_at_start) as Conversation['levelAtStart'],
  context: parse(r.context),
  retention: str(r.retention) as Conversation['retention'],
  expiresAt: strOrNull(r.expires_at),
  userMessageCount: num(r.user_message_count),
  correctedSkills: parse(r.corrected_skills),
  contentDeletedAt: strOrNull(r.content_deleted_at),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
  endedAt: strOrNull(r.ended_at),
});

const toMessage = (r: Row): Message => ({
  id: str(r.id),
  conversationId: str(r.conversation_id),
  role: str(r.role) as Message['role'],
  content: str(r.content),
  translation: strOrNull(r.translation),
  corrections: parse(r.corrections),
  deferredCorrections: parse(r.deferred_corrections),
  notices: parse(r.notices),
  createdAt: str(r.created_at),
});

export function createSqliteStore(db: DatabaseSync): DataStore {
  const one = <T>(sql: string, params: Params, map: (row: Row) => T): T | null => {
    const row = db.prepare(sql).get(params) as Row | undefined;
    return row ? map(row) : null;
  };
  const many = <T>(sql: string, params: Params, map: (row: Row) => T): T[] =>
    (db.prepare(sql).all(params) as Row[]).map(map);
  const run = (sql: string, params: Params) => {
    db.prepare(sql).run(params);
  };

  return {
    users: {
      findById: async (id) => one('SELECT * FROM users WHERE id = @id', { id }, toUser),
      findByEmail: async (email) => one('SELECT * FROM users WHERE email = @email', { email }, toUser),
      create: async (user) =>
        run(
          `INSERT INTO users (id, name, email, password_hash, role, created_at, terms_accepted_at)
           VALUES (@id, @name, @email, @password_hash, @role, @created_at, @terms_accepted_at)`,
          {
            id: user.id,
            name: user.name,
            email: user.email,
            password_hash: user.passwordHash,
            role: user.role,
            created_at: user.createdAt,
            terms_accepted_at: user.termsAcceptedAt,
          },
        ),
      updatePassword: async (userId, passwordHash) =>
        run('UPDATE users SET password_hash = @passwordHash, session_version = session_version + 1 WHERE id = @userId', {
          userId,
          passwordHash,
        }),
    },
    passwordResets: {
      create: async (t) =>
        run(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
           VALUES (@id, @user_id, @token_hash, @expires_at, @used_at, @created_at)`,
          { id: t.id, user_id: t.userId, token_hash: t.tokenHash, expires_at: t.expiresAt, used_at: t.usedAt, created_at: t.createdAt },
        ),
      findByTokenHash: async (tokenHash) =>
        one('SELECT * FROM password_reset_tokens WHERE token_hash = @tokenHash', { tokenHash }, toPasswordReset),
      latestForUser: async (userId) =>
        one(
          'SELECT * FROM password_reset_tokens WHERE user_id = @userId ORDER BY created_at DESC, rowid DESC LIMIT 1',
          { userId },
          toPasswordReset,
        ),
      // Atômico no SQLite: só uma das requisições concorrentes encontra used_at vazio.
      markUsed: async (id, usedAt) =>
        db.prepare('UPDATE password_reset_tokens SET used_at = @usedAt WHERE id = @id AND used_at IS NULL').run({ id, usedAt }).changes === 1,
      deleteForUser: async (userId) => run('DELETE FROM password_reset_tokens WHERE user_id = @userId', { userId }),
      deleteExpired: async (beforeIso) =>
        Number(db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < @beforeIso').run({ beforeIso }).changes),
    },
    profiles: {
      get: async (userId) => one('SELECT * FROM learning_profiles WHERE user_id = @userId', { userId }, toProfile),
      save: async (p) =>
        run(
          `INSERT INTO learning_profiles (user_id, goal, perceived_level, prior_experience, conversation_interest,
             professional_interest, interest_areas, estimated_level, placement_score, placement_completed_at,
             onboarding_completed_at, difficulties, updated_at)
           VALUES (@user_id, @goal, @perceived_level, @prior_experience, @conversation_interest, @professional_interest,
             @interest_areas, @estimated_level, @placement_score, @placement_completed_at, @onboarding_completed_at,
             @difficulties, @updated_at)
           ON CONFLICT(user_id) DO UPDATE SET goal = excluded.goal, perceived_level = excluded.perceived_level,
             prior_experience = excluded.prior_experience, conversation_interest = excluded.conversation_interest,
             professional_interest = excluded.professional_interest, interest_areas = excluded.interest_areas,
             estimated_level = excluded.estimated_level, placement_score = excluded.placement_score,
             placement_completed_at = excluded.placement_completed_at,
             onboarding_completed_at = excluded.onboarding_completed_at, difficulties = excluded.difficulties,
             updated_at = excluded.updated_at`,
          {
            user_id: p.userId,
            goal: p.goal,
            perceived_level: p.perceivedLevel,
            prior_experience: p.priorExperience,
            conversation_interest: bool(p.conversationInterest),
            professional_interest: bool(p.professionalInterest),
            interest_areas: json(p.interestAreas),
            estimated_level: p.estimatedLevel,
            placement_score: p.placementScore,
            placement_completed_at: p.placementCompletedAt,
            onboarding_completed_at: p.onboardingCompletedAt,
            difficulties: json(p.difficulties),
            updated_at: p.updatedAt,
          },
        ),
    },
    preferences: {
      get: async (userId) => one('SELECT * FROM preferences WHERE user_id = @userId', { userId }, toPreferences),
      save: async (p) =>
        run(
          `INSERT INTO preferences (user_id, explanation_language, correction_intensity, reply_length, show_translations,
             save_conversation_history, study_reminders, daily_goal_minutes, updated_at)
           VALUES (@user_id, @explanation_language, @correction_intensity, @reply_length, @show_translations,
             @save_conversation_history, @study_reminders, @daily_goal_minutes, @updated_at)
           ON CONFLICT(user_id) DO UPDATE SET explanation_language = excluded.explanation_language,
             correction_intensity = excluded.correction_intensity, reply_length = excluded.reply_length,
             show_translations = excluded.show_translations, save_conversation_history = excluded.save_conversation_history,
             study_reminders = excluded.study_reminders, daily_goal_minutes = excluded.daily_goal_minutes,
             updated_at = excluded.updated_at`,
          {
            user_id: p.userId,
            explanation_language: p.explanationLanguage,
            correction_intensity: p.correctionIntensity,
            reply_length: p.replyLength,
            show_translations: bool(p.showTranslations),
            save_conversation_history: bool(p.saveConversationHistory),
            study_reminders: bool(p.studyReminders),
            daily_goal_minutes: p.dailyGoalMinutes,
            updated_at: p.updatedAt,
          },
        ),
    },
    progress: {
      get: async (userId, lessonId) =>
        one('SELECT * FROM progress WHERE user_id = @userId AND lesson_id = @lessonId', { userId, lessonId }, toProgress),
      listByUser: async (userId) => many('SELECT * FROM progress WHERE user_id = @userId', { userId }, toProgress),
      save: async (p) =>
        run(
          `INSERT INTO progress (user_id, lesson_id, status, correct_count, total_count, score, time_spent_seconds,
             started_at, completed_at, updated_at)
           VALUES (@user_id, @lesson_id, @status, @correct_count, @total_count, @score, @time_spent_seconds,
             @started_at, @completed_at, @updated_at)
           ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = excluded.status, correct_count = excluded.correct_count,
             total_count = excluded.total_count, score = excluded.score, time_spent_seconds = excluded.time_spent_seconds,
             started_at = excluded.started_at, completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
          {
            user_id: p.userId,
            lesson_id: p.lessonId,
            status: p.status,
            correct_count: p.correctCount,
            total_count: p.totalCount,
            score: p.score,
            time_spent_seconds: p.timeSpentSeconds,
            started_at: p.startedAt,
            completed_at: p.completedAt,
            updated_at: p.updatedAt,
          },
        ),
    },
    attempts: {
      add: async (a) =>
        run(
          `INSERT INTO exercise_attempts (id, user_id, exercise_id, lesson_id, skill_tag, context, answer, is_correct, created_at)
           VALUES (@id, @user_id, @exercise_id, @lesson_id, @skill_tag, @context, @answer, @is_correct, @created_at)`,
          {
            id: a.id,
            user_id: a.userId,
            exercise_id: a.exerciseId,
            lesson_id: a.lessonId,
            skill_tag: a.skillTag,
            context: a.context,
            answer: a.answer,
            is_correct: bool(a.isCorrect),
            created_at: a.createdAt,
          },
        ),
      listByUser: async (userId) =>
        many('SELECT * FROM exercise_attempts WHERE user_id = @userId ORDER BY created_at, rowid', { userId }, toAttempt),
    },
    userVocabulary: {
      listByUser: async (userId) => many('SELECT * FROM user_vocabulary WHERE user_id = @userId', { userId }, toUserVocabulary),
      get: async (userId, vocabularyId) =>
        one(
          'SELECT * FROM user_vocabulary WHERE user_id = @userId AND vocabulary_id = @vocabularyId',
          { userId, vocabularyId },
          toUserVocabulary,
        ),
      save: async (v) =>
        run(
          `INSERT INTO user_vocabulary (user_id, vocabulary_id, status, times_reviewed, first_seen_at, last_reviewed_at, next_review_at)
           VALUES (@user_id, @vocabulary_id, @status, @times_reviewed, @first_seen_at, @last_reviewed_at, @next_review_at)
           ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET status = excluded.status, times_reviewed = excluded.times_reviewed,
             last_reviewed_at = excluded.last_reviewed_at, next_review_at = excluded.next_review_at`,
          {
            user_id: v.userId,
            vocabulary_id: v.vocabularyId,
            status: v.status,
            times_reviewed: v.timesReviewed,
            first_seen_at: v.firstSeenAt,
            last_reviewed_at: v.lastReviewedAt,
            next_review_at: v.nextReviewAt,
          },
        ),
    },
    reviews: {
      listByUser: async (userId) => many('SELECT * FROM reviews WHERE user_id = @userId ORDER BY created_at, rowid', { userId }, toReview),
      get: async (id) => one('SELECT * FROM reviews WHERE id = @id', { id }, toReview),
      save: async (r) =>
        run(
          `INSERT INTO reviews (id, user_id, kind, ref_id, reason, status, due_at, interval_step, times_reviewed, last_score,
             time_spent_seconds, last_reviewed_at, created_at)
           VALUES (@id, @user_id, @kind, @ref_id, @reason, @status, @due_at, @interval_step, @times_reviewed, @last_score,
             @time_spent_seconds, @last_reviewed_at, @created_at)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status, reason = excluded.reason, due_at = excluded.due_at,
             interval_step = excluded.interval_step, times_reviewed = excluded.times_reviewed, last_score = excluded.last_score,
             time_spent_seconds = excluded.time_spent_seconds, last_reviewed_at = excluded.last_reviewed_at`,
          {
            id: r.id,
            user_id: r.userId,
            kind: r.kind,
            ref_id: r.refId,
            reason: r.reason,
            status: r.status,
            due_at: r.dueAt,
            interval_step: r.intervalStep,
            times_reviewed: r.timesReviewed,
            last_score: r.lastScore,
            time_spent_seconds: r.timeSpentSeconds,
            last_reviewed_at: r.lastReviewedAt,
            created_at: r.createdAt,
          },
        ),
    },
    conversations: {
      listByUser: async (userId) => many('SELECT * FROM conversations WHERE user_id = @userId', { userId }, toConversation),
      get: async (id) => one('SELECT * FROM conversations WHERE id = @id', { id }, toConversation),
      listExpired: async (nowIso) =>
        many(
          'SELECT * FROM conversations WHERE content_deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at < @now',
          { now: nowIso },
          toConversation,
        ),
      save: async (c) =>
        run(
          `INSERT INTO conversations (id, user_id, topic_id, title, level_at_start, context, retention, expires_at,
             user_message_count, corrected_skills, content_deleted_at, created_at, updated_at, ended_at)
           VALUES (@id, @user_id, @topic_id, @title, @level_at_start, @context, @retention, @expires_at,
             @user_message_count, @corrected_skills, @content_deleted_at, @created_at, @updated_at, @ended_at)
           ON CONFLICT(id) DO UPDATE SET context = excluded.context, expires_at = excluded.expires_at,
             user_message_count = excluded.user_message_count, corrected_skills = excluded.corrected_skills,
             content_deleted_at = excluded.content_deleted_at, updated_at = excluded.updated_at, ended_at = excluded.ended_at`,
          {
            id: c.id,
            user_id: c.userId,
            topic_id: c.topicId,
            title: c.title,
            level_at_start: c.levelAtStart,
            context: json(c.context),
            retention: c.retention,
            expires_at: c.expiresAt,
            user_message_count: c.userMessageCount,
            corrected_skills: json(c.correctedSkills),
            content_deleted_at: c.contentDeletedAt,
            created_at: c.createdAt,
            updated_at: c.updatedAt,
            ended_at: c.endedAt,
          },
        ),
    },
    messages: {
      listByConversation: async (conversationId) =>
        many(
          'SELECT * FROM messages WHERE conversation_id = @conversationId ORDER BY created_at, rowid',
          { conversationId },
          toMessage,
        ),
      add: async (m) =>
        run(
          `INSERT INTO messages (id, conversation_id, role, content, translation, corrections, deferred_corrections, notices, created_at)
           VALUES (@id, @conversation_id, @role, @content, @translation, @corrections, @deferred_corrections, @notices, @created_at)`,
          {
            id: m.id,
            conversation_id: m.conversationId,
            role: m.role,
            content: m.content,
            translation: m.translation,
            corrections: json(m.corrections),
            deferred_corrections: json(m.deferredCorrections),
            notices: json(m.notices),
            created_at: m.createdAt,
          },
        ),
      deleteByConversation: async (conversationId) =>
        run('DELETE FROM messages WHERE conversation_id = @conversationId', { conversationId }),
    },
    // Todas as tabelas do usuário usam ON DELETE CASCADE (RF20).
    deleteUserData: async (userId) => transaction(db, () => run('DELETE FROM users WHERE id = @userId', { userId })),
  };
}
