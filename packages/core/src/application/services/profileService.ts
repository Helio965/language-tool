/**
 * UC03 — Configurar perfil · UC12 — Configurar preferências.
 */
import type { Preferences } from '../../domain/entities';
import { AppError, type FieldErrors } from '../../domain/errors';
import { LEVELS } from '../../domain/levels';
import {
  GOALS,
  INTEREST_AREAS,
  MAX_INTEREST_AREAS,
  PRIOR_EXPERIENCES,
} from '../../domain/profile';
import { DAILY_GOAL_OPTIONS, loadPreferences, loadProfile, requireUser, type ServiceContext } from '../context';
import type { PreferencesInput, ProfileInput } from '../views';

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function validateProfileInput(input: ProfileInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!includes(GOALS, input.goal)) errors.goal = 'Escolha um objetivo.';
  if (input.perceivedLevel !== 'unknown' && !includes(LEVELS, input.perceivedLevel)) errors.perceivedLevel = 'Escolha uma opção.';
  if (!includes(PRIOR_EXPERIENCES, input.priorExperience)) errors.priorExperience = 'Escolha uma opção.';
  if (!Array.isArray(input.interestAreas) || input.interestAreas.some((area) => !includes(INTEREST_AREAS, area))) {
    errors.interestAreas = 'Escolha áreas válidas.';
  } else if (input.interestAreas.length > MAX_INTEREST_AREAS) {
    errors.interestAreas = `Escolha até ${MAX_INTEREST_AREAS} áreas.`;
  }
  return errors;
}

const PREFERENCE_ENUMS = {
  explanationLanguage: ['auto', 'pt', 'en'],
  correctionIntensity: ['light', 'balanced', 'detailed'],
  replyLength: ['short', 'balanced'],
} as const;

const PREFERENCE_BOOLEANS = ['showTranslations', 'saveConversationHistory', 'studyReminders'] as const;

export function createProfileService(ctx: ServiceContext) {
  return {
    async getProfile(userId: string) {
      await requireUser(ctx, userId);
      return loadProfile(ctx, userId);
    },

    async saveProfile(userId: string, input: ProfileInput) {
      await requireUser(ctx, userId);
      const errors = validateProfileInput(input);
      if (Object.keys(errors).length) throw new AppError('VALIDATION', 'Perfil inválido.', errors);
      const current = await loadProfile(ctx, userId);
      const now = ctx.now().toISOString();
      const profile = {
        ...current,
        goal: input.goal,
        perceivedLevel: input.perceivedLevel,
        priorExperience: input.priorExperience,
        conversationInterest: Boolean(input.conversationInterest),
        professionalInterest: Boolean(input.professionalInterest),
        interestAreas: [...new Set(input.interestAreas)],
        onboardingCompletedAt: current.onboardingCompletedAt ?? now,
        updatedAt: now,
      };
      await ctx.store.profiles.save(profile);
      return profile;
    },

    async getPreferences(userId: string): Promise<Preferences> {
      await requireUser(ctx, userId);
      return loadPreferences(ctx, userId);
    },

    async updatePreferences(userId: string, input: PreferencesInput): Promise<Preferences> {
      await requireUser(ctx, userId);
      const current = await loadPreferences(ctx, userId);
      const next: Preferences = { ...current, updatedAt: ctx.now().toISOString() };
      const errors: FieldErrors = {};
      for (const [key, allowed] of Object.entries(PREFERENCE_ENUMS) as Array<[keyof typeof PREFERENCE_ENUMS, readonly string[]]>) {
        const value = input[key];
        if (value === undefined) continue;
        if (!allowed.includes(value)) errors[key] = 'Opção inválida.';
        else (next as unknown as Record<string, unknown>)[key] = value;
      }
      for (const key of PREFERENCE_BOOLEANS) {
        const value = input[key];
        if (value === undefined) continue;
        if (typeof value !== 'boolean') errors[key] = 'Valor inválido.';
        else next[key] = value;
      }
      if (input.dailyGoalMinutes !== undefined) {
        if (!(DAILY_GOAL_OPTIONS as readonly number[]).includes(input.dailyGoalMinutes)) errors.dailyGoalMinutes = 'Escolha uma meta válida.';
        else next.dailyGoalMinutes = input.dailyGoalMinutes;
      }
      if (Object.keys(errors).length) throw new AppError('VALIDATION', 'Preferências inválidas.', errors);
      await ctx.store.preferences.save(next);
      return next;
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
