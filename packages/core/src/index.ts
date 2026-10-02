// Domínio
export * from './domain/levels';
export * from './domain/profile';
export * from './domain/skills';
export * from './domain/entities';
export * from './domain/content';
export * from './domain/errors';
export * from './domain/text';
export * from './domain/validation';
export * from './domain/privacy';
export * from './domain/grading';
export * from './domain/placement';
export * from './domain/progress';
export * from './domain/review';

// Conteúdo
export * from './content/catalog';
export { LESSONS } from './content/lessons';
export { VOCABULARY } from './content/vocabulary';
export { PLACEMENT_QUESTIONS, PLACEMENT_STAGES, PLACEMENT_PASS_THRESHOLD } from './content/placement';
export { CONVERSATION_TOPICS, LESSON_PRACTICE_PREFIX } from './content/topics';

// IA
export * from './ai/types';
export * from './ai/persona';
export * from './ai/levelPolicy';
export * from './ai/correctionPolicy';
export * from './ai/prompts';
export * from './ai/grammar/types';
export { checkGrammar, applyIssues, buildCorrection, resolveOverlaps } from './ai/grammar/checker';
export { GRAMMAR_RULES } from './ai/grammar/rules';
export { MockAIService } from './ai/mock/mockAIService';
export { LLMAIService, toGrammarIssues } from './ai/llm/llmAIService';
export { FallbackAIService, type FallbackListener } from './ai/llm/fallbackAIService';
export * from './ai/llm/provider';

// Aplicação
export * from './application/ports';
export * from './application/views';
export { createAppServices, type AppServices } from './application/createAppServices';
export { DAILY_GOAL_OPTIONS, DEFAULT_TIME_ZONE, defaultPreferences, defaultProfile } from './application/context';

// Infraestrutura portátil
export * from './infrastructure/documentStore';
export * from './infrastructure/pbkdf2Hasher';
