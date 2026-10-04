import { policyFor, resolveExplanationLanguage } from '../ai/levelPolicy';
import type { LearnerContext } from '../ai/types';
import type { LearningProfile, Preferences, User, UserRecord } from '../domain/entities';
import { AppError } from '../domain/errors';
import { firstName } from '../domain/text';
import type { AppDependencies, DataStore, PasswordHasher } from './ports';
import type { AccountState, NextStep } from './views';
import type { ContentCatalog } from '../content/catalog';
import type { AIService } from '../ai/types';

export interface ServiceContext {
  store: DataStore;
  catalog: ContentCatalog;
  ai: AIService;
  hasher: PasswordHasher;
  now: () => Date;
  id: () => string;
  timeZone: string;
  retentionDays: number;
  maxHistory: number;
  resetTtlMinutes: number;
}

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function createContext(deps: AppDependencies): ServiceContext {
  return {
    store: deps.store,
    catalog: deps.catalog,
    ai: deps.ai,
    hasher: deps.passwordHasher,
    now: deps.now ?? (() => new Date()),
    id: deps.generateId ?? (() => globalThis.crypto.randomUUID()),
    timeZone: deps.timeZone ?? DEFAULT_TIME_ZONE,
    retentionDays: deps.conversationRetentionDays ?? 90,
    maxHistory: deps.maxHistoryMessages ?? 12,
    resetTtlMinutes: deps.passwordResetTtlMinutes ?? 15,
  };
}

export function defaultProfile(userId: string, now: Date): LearningProfile {
  return {
    userId,
    goal: null,
    perceivedLevel: 'unknown',
    priorExperience: null,
    conversationInterest: false,
    professionalInterest: false,
    interestAreas: [],
    estimatedLevel: null,
    placementScore: null,
    placementCompletedAt: null,
    onboardingCompletedAt: null,
    difficulties: [],
    updatedAt: now.toISOString(),
  };
}

export const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30] as const;

export function defaultPreferences(userId: string, now: Date): Preferences {
  return {
    userId,
    explanationLanguage: 'auto',
    correctionIntensity: 'balanced',
    replyLength: 'balanced',
    showTranslations: true,
    saveConversationHistory: true,
    studyReminders: false,
    dailyGoalMinutes: 10,
    updatedAt: now.toISOString(),
  };
}

export function publicUser(record: UserRecord): User {
  const { passwordHash: _hash, sessionVersion: _version, ...user } = record;
  return user;
}

export async function requireUser(ctx: ServiceContext, userId: string): Promise<UserRecord> {
  const user = await ctx.store.users.findById(userId);
  if (!user) throw new AppError('UNAUTHENTICATED', 'Usuário não encontrado.');
  return user;
}

export async function loadProfile(ctx: ServiceContext, userId: string): Promise<LearningProfile> {
  return (await ctx.store.profiles.get(userId)) ?? defaultProfile(userId, ctx.now());
}

export async function loadPreferences(ctx: ServiceContext, userId: string): Promise<Preferences> {
  return (await ctx.store.preferences.get(userId)) ?? defaultPreferences(userId, ctx.now());
}

export function nextStepFor(profile: LearningProfile): NextStep {
  if (!profile.onboardingCompletedAt) return 'onboarding';
  if (!profile.placementCompletedAt || !profile.estimatedLevel) return 'placement';
  return 'ready';
}

export interface LearnerBundle {
  user: UserRecord;
  profile: LearningProfile;
  preferences: Preferences;
  learner: LearnerContext;
}

export async function loadLearner(ctx: ServiceContext, userId: string): Promise<LearnerBundle> {
  const user = await requireUser(ctx, userId);
  const [profile, preferences] = await Promise.all([loadProfile(ctx, userId), loadPreferences(ctx, userId)]);
  const level = profile.estimatedLevel ?? 'beginner';
  const learner: LearnerContext = {
    firstName: firstName(user.name),
    level,
    goal: profile.goal,
    interestAreas: profile.interestAreas,
    explanationLanguage: resolveExplanationLanguage(level, preferences.explanationLanguage),
    correctionIntensity: preferences.correctionIntensity,
    replyLength: preferences.replyLength,
    showTranslations: preferences.showTranslations && policyFor(level).conversationTranslations,
    difficulties: profile.difficulties,
  };
  return { user, profile, preferences, learner };
}

export async function accountState(ctx: ServiceContext, user: UserRecord): Promise<AccountState> {
  const [profile, preferences] = await Promise.all([loadProfile(ctx, user.id), loadPreferences(ctx, user.id)]);
  return { user: publicUser(user), profile, preferences, nextStep: nextStepFor(profile), aiProvider: ctx.ai.providerName };
}
