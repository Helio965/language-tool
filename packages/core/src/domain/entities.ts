/**
 * Entidades persistidas. Espelham o modelo descrito em docs/DATABASE-MODEL.md
 * (Análise de requisitos §20 + entidades de apoio ExerciseAttempt, UserVocabulary, Message, Review e Preference).
 * Datas são strings ISO 8601 (UTC) para serem portáveis entre navegador, API e banco.
 */
import type { Level } from './levels';
import type { Goal, InterestArea, PerceivedLevel, PriorExperience } from './profile';
import type { SkillTag } from './skills';

export type ISODate = string;

export type UserRole = 'user' | 'admin';

/** Usuário: dados de identificação e credenciais. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: ISODate;
  termsAcceptedAt: ISODate;
}

/** Registro interno com credencial — nunca deve sair da camada de aplicação. */
export interface UserRecord extends User {
  passwordHash: string;
}

/** Perfil de aprendizagem: nível, objetivo, dificuldades e dados de personalização. */
export interface LearningProfile {
  userId: string;
  goal: Goal | null;
  perceivedLevel: PerceivedLevel;
  priorExperience: PriorExperience | null;
  conversationInterest: boolean;
  professionalInterest: boolean;
  interestAreas: InterestArea[];
  estimatedLevel: Level | null;
  placementScore: number | null;
  placementCompletedAt: ISODate | null;
  onboardingCompletedAt: ISODate | null;
  /** Temas com erros recorrentes, recalculados a cada tentativa de exercício. */
  difficulties: SkillTag[];
  updatedAt: ISODate;
}

export type ExplanationLanguage = 'auto' | 'pt' | 'en';
export type CorrectionIntensity = 'light' | 'balanced' | 'detailed';
export type ReplyLength = 'short' | 'balanced';

/** Preferências de aprendizagem e interação (RF19 / UC12). */
export interface Preferences {
  userId: string;
  explanationLanguage: ExplanationLanguage;
  correctionIntensity: CorrectionIntensity;
  replyLength: ReplyLength;
  showTranslations: boolean;
  saveConversationHistory: boolean;
  studyReminders: boolean;
  dailyGoalMinutes: number;
  updatedAt: ISODate;
}

export type ProgressStatus = 'in_progress' | 'completed';

/** Progresso do usuário em uma aula. Métricas agregadas são calculadas a partir destes registros. */
export interface Progress {
  userId: string;
  lessonId: string;
  status: ProgressStatus;
  correctCount: number;
  totalCount: number;
  /** Percentual de acertos na última conclusão (0–100). */
  score: number;
  timeSpentSeconds: number;
  startedAt: ISODate;
  completedAt: ISODate | null;
  updatedAt: ISODate;
}

export type AttemptContext = 'lesson' | 'placement' | 'review';

/** Resposta do usuário a um exercício. */
export interface ExerciseAttempt {
  id: string;
  userId: string;
  exerciseId: string;
  lessonId: string | null;
  skillTag: SkillTag;
  context: AttemptContext;
  answer: string;
  isCorrect: boolean;
  createdAt: ISODate;
}

export type VocabularyStatus = 'learning' | 'learned';

/** Relação usuário × palavra: estado e frequência de revisão. */
export interface UserVocabulary {
  userId: string;
  vocabularyId: string;
  status: VocabularyStatus;
  timesReviewed: number;
  firstSeenAt: ISODate;
  lastReviewedAt: ISODate | null;
  nextReviewAt: ISODate;
}

export type ReviewKind = 'lesson' | 'skill' | 'vocabulary';
export type ReviewReason = 'errors' | 'low_score' | 'spaced' | 'conversation' | 'vocabulary_due';
export type ReviewStatus = 'pending' | 'done';

/** Item de revisão com o motivo que o gerou (UC08). */
export interface Review {
  id: string;
  userId: string;
  kind: ReviewKind;
  /** lessonId, skillTag ou "vocabulary". */
  refId: string;
  reason: ReviewReason;
  status: ReviewStatus;
  dueAt: ISODate;
  /** Posição na sequência de intervalos da revisão espaçada simples. */
  intervalStep: number;
  timesReviewed: number;
  lastScore: number | null;
  timeSpentSeconds: number;
  lastReviewedAt: ISODate | null;
  createdAt: ISODate;
}

export type ConversationRetention = 'saved' | 'ephemeral';

/** Memória curta da conversa: fatos ditos pelo usuário e perguntas já feitas. */
export interface ConversationContext {
  facts: Record<string, string>;
  askedQuestionIds: string[];
  turn: number;
  turnsSinceInlineCorrection: number;
}

/** Conversa no Modo Conversação (UC09). */
export interface Conversation {
  id: string;
  userId: string;
  topicId: string;
  title: string;
  levelAtStart: Level;
  context: ConversationContext;
  retention: ConversationRetention;
  /** Quando o conteúdo das mensagens será excluído automaticamente. */
  expiresAt: ISODate | null;
  /** Metadados mínimos mantidos para o progresso mesmo após excluir o conteúdo. */
  userMessageCount: number;
  correctedSkills: SkillTag[];
  contentDeletedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  endedAt: ISODate | null;
}

export type CorrectionSeverity = 'meaning' | 'grammar' | 'naturalness';

/** Correção pedagógica: o que o usuário escreveu, a forma recomendada e o porquê. */
export interface Correction {
  original: string;
  suggestion: string;
  /** Trechos alterados — permitem destacar a mudança na interface. */
  changes: Array<{ from: string; to: string }>;
  explanation: string;
  tip: string | null;
  severity: CorrectionSeverity;
  skillTag: SkillTag;
  ruleId: string;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  /** Apoio em português para níveis iniciais (quando habilitado nas preferências). */
  translation: string | null;
  /** Correções exibidas junto da mensagem (discretas). */
  corrections: Correction[];
  /** Correções guardadas para o resumo final, sem interromper a conversa. */
  deferredCorrections: Correction[];
  /** Avisos de privacidade (ex.: dado pessoal removido antes do envio à IA). */
  notices: string[];
  createdAt: ISODate;
}
