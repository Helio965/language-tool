import type { Level } from './levels';

/** Objetivos de aprendizagem (Análise de requisitos, RF04). */
export const GOALS = ['basics', 'conversation', 'work', 'travel', 'technology'] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  basics: 'Aprender o básico',
  conversation: 'Conversar',
  work: 'Usar no trabalho',
  travel: 'Viajar',
  technology: 'Inglês para tecnologia',
};

export const GOAL_DESCRIPTIONS: Record<Goal, string> = {
  basics: 'Começar do zero com uma base sólida.',
  conversation: 'Ganhar confiança para falar no dia a dia.',
  work: 'Reuniões, e-mails e situações profissionais.',
  travel: 'Aeroporto, hotel, restaurante e passeios.',
  technology: 'Vocabulário e comunicação na área de tecnologia.',
};

/** Experiência anterior (Especificação UC03). */
export const PRIOR_EXPERIENCES = ['none', 'school', 'course', 'self_taught'] as const;
export type PriorExperience = (typeof PRIOR_EXPERIENCES)[number];

export const PRIOR_EXPERIENCE_LABELS: Record<PriorExperience, string> = {
  none: 'Nunca estudei',
  school: 'Estudei na escola',
  course: 'Já fiz curso',
  self_taught: 'Estudei sozinho(a)',
};

/** Áreas de interesse (Especificação UC03) — usadas para sugerir assuntos de conversa. */
export const INTEREST_AREAS = [
  'technology',
  'business',
  'travel',
  'food',
  'entertainment',
  'sports',
  'education',
  'everyday',
] as const;
export type InterestArea = (typeof INTEREST_AREAS)[number];

export const INTEREST_AREA_LABELS: Record<InterestArea, string> = {
  technology: 'Tecnologia',
  business: 'Negócios',
  travel: 'Viagens',
  food: 'Comida',
  entertainment: 'Filmes e séries',
  sports: 'Esportes',
  education: 'Estudos',
  everyday: 'Dia a dia',
};

export type PerceivedLevel = Level | 'unknown';

export const PERCEIVED_LEVEL_LABELS: Record<PerceivedLevel, string> = {
  unknown: 'Não sei dizer',
  beginner: 'Iniciante',
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const MAX_INTEREST_AREAS = 3;
