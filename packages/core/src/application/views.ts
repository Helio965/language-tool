/**
 * Objetos de visualização (DTOs) trocados entre casos de uso, API e interface.
 * Nunca contêm hash de senha nem gabaritos de exercícios.
 */
import type { Language } from '../ai/levelPolicy';
import type {
  ConversationTopic,
  Example,
  GrammarTable,
  PublicExercise,
  PublicPlacementQuestion,
  VocabularyEntry,
} from '../domain/content';
import type {
  Correction,
  CorrectionIntensity,
  ExplanationLanguage,
  LearningProfile,
  Message,
  Preferences,
  ReplyLength,
  ReviewKind,
  ReviewReason,
  User,
  VocabularyStatus,
} from '../domain/entities';
import type { GradeStatus } from '../domain/grading';
import type { Level } from '../domain/levels';
import type { PlacementStageResult } from '../domain/placement';
import type { Goal, InterestArea, PerceivedLevel, PriorExperience } from '../domain/profile';
import type { ProgressSnapshot, RecurringError } from '../domain/progress';
import type { SkillTag } from '../domain/skills';

export type NextStep = 'onboarding' | 'placement' | 'ready';

export interface AccountState {
  user: User;
  profile: LearningProfile;
  preferences: Preferences;
  nextStep: NextStep;
  aiProvider: string;
}

export interface ProfileInput {
  goal: Goal;
  perceivedLevel: PerceivedLevel;
  priorExperience: PriorExperience;
  conversationInterest: boolean;
  professionalInterest: boolean;
  interestAreas: InterestArea[];
}

export type PreferencesInput = Partial<{
  explanationLanguage: ExplanationLanguage;
  correctionIntensity: CorrectionIntensity;
  replyLength: ReplyLength;
  showTranslations: boolean;
  saveConversationHistory: boolean;
  studyReminders: boolean;
  dailyGoalMinutes: number;
}>;

export type PlacementStepView =
  | {
      status: 'continue';
      stageNumber: number;
      totalStages: number;
      questions: PublicPlacementQuestion[];
    }
  | { status: 'done'; result: PlacementResultView };

export interface PlacementResultView {
  level: Level;
  levelLabel: string;
  levelDescription: string;
  score: number;
  correct: number;
  answered: number;
  stages: PlacementStageResult[];
  perceivedLevel: PerceivedLevel;
  comparison: string;
  skipped: boolean;
}

export type LessonStatus = 'completed' | 'in_progress' | 'available';

export interface LessonSummary {
  id: string;
  title: string;
  topic: string;
  level: Level;
  order: number;
  summary: string;
  estimatedMinutes: number;
  exerciseCount: number;
  status: LessonStatus;
  score: number | null;
  recommended: boolean;
  aboveLevel: boolean;
}

export interface LessonView extends LessonSummary {
  objectives: string[];
  language: Language;
  supportLanguageAvailable: boolean;
  explanation: Array<{ primary: string; support: string }>;
  table: GrammarTable | null;
  examples: Example[];
  vocabulary: VocabularyEntry[];
  exercises: PublicExercise[];
  practiceTopicId: string;
  takeaways: string[];
}

export interface ExerciseFeedback {
  exerciseId: string;
  status: GradeStatus;
  title: string;
  userAnswer: string;
  expectedAnswer: string | null;
  explanation: string;
  supportExplanation: string | null;
  tip: string | null;
  /** Correção no formato "Sua frase / Forma recomendada / Explicação" (respostas abertas). */
  correction: Correction | null;
  aiFeedback: string | null;
}

export interface LessonResult {
  lessonId: string;
  correct: number;
  total: number;
  score: number;
  timeSpentSeconds: number;
  newWords: VocabularyEntry[];
  levelUp: { level: Level; label: string } | null;
  nextLesson: LessonSummary | null;
  takeaways: string[];
  practiceTopicId: string;
  reviewSuggested: boolean;
}

export interface TopicView extends ConversationTopic {
  recommended: boolean;
  aboveLevel: boolean;
}

export interface ConversationSummaryView {
  id: string;
  topicId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  messageCount: number;
  preview: string;
  retention: 'saved' | 'ephemeral';
}

export interface ConversationView extends ConversationSummaryView {
  level: Level;
  messages: Message[];
}

export interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

export interface ConversationFeedbackView {
  conversationId: string;
  title: string;
  userMessages: number;
  durationMinutes: number;
  cleanMessages: number;
  corrections: Correction[];
  suggestedLessons: Array<{ lessonId: string; title: string; skillTag: SkillTag }>;
  contentDeleted: boolean;
}

export interface VocabularyItemView extends VocabularyEntry {
  status: VocabularyStatus | null;
  timesReviewed: number;
  nextReviewAt: string | null;
  due: boolean;
  lessonId: string | null;
  lessonTitle: string | null;
}

export interface VocabularyOverview {
  studied: VocabularyItemView[];
  suggestions: VocabularyItemView[];
  counts: { studied: number; learning: number; learned: number; due: number };
}

export interface ReviewItemView {
  id: string;
  kind: ReviewKind;
  reason: ReviewReason;
  title: string;
  reasonText: string;
  dueAt: string;
  lessonId: string | null;
  estimatedMinutes: number;
}

export interface ReviewQueueView {
  due: ReviewItemView[];
  upcoming: ReviewItemView[];
  completedCount: number;
}

export interface ReviewSessionView {
  review: ReviewItemView;
  exercises: PublicExercise[];
}

export interface ReviewResult {
  reviewId: string;
  correct: number;
  total: number;
  score: number;
  nextReviewAt: string | null;
  message: string;
}

export interface ProgressOverview extends ProgressSnapshot {
  needsReview: ReviewItemView[];
  recurringErrors: RecurringError[];
  recentLessons: Array<{ lessonId: string; title: string; score: number; completedAt: string }>;
}

export interface HomeDashboard {
  firstName: string;
  level: Level | null;
  levelLabel: string | null;
  goal: Goal | null;
  goalLabel: string | null;
  continueLesson: LessonSummary | null;
  /** Total de revisões pendentes e as primeiras da fila (para o atalho do Início). */
  reviewCount: number;
  reviewDue: ReviewItemView[];
  recentWords: VocabularyItemView[];
  streakDays: number;
  todayMinutes: number;
  dailyGoalMinutes: number;
  lessonsCompleted: number;
  accuracy: number | null;
  lastConversation: ConversationSummaryView | null;
  hasActivity: boolean;
}
