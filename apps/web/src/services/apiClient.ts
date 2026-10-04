/**
 * Porta única de dados das telas. Duas implementações:
 * - DemoApiClient: casos de uso do core no navegador (protótipo navegável, sem servidor);
 * - HttpApiClient: API REST real (apps/api), com sessão em cookie httpOnly.
 */
import type {
  AccountState,
  ConversationFeedbackView,
  ConversationSummaryView,
  ConversationView,
  Example,
  ExerciseFeedback,
  HomeDashboard,
  LearningProfile,
  LessonResult,
  LessonSummary,
  LessonView,
  LoginInput,
  PlacementResultView,
  PlacementStepView,
  Preferences,
  PreferencesInput,
  ProfileInput,
  ProgressOverview,
  RegistrationInput,
  ResetPasswordInput,
  ResetTokenStatus,
  ReviewQueueView,
  ReviewResult,
  ReviewSessionView,
  SendMessageResult,
  TopicView,
  VocabularyItemView,
  VocabularyOverview,
  VocabularyStatus,
} from '@english-ai/core';

export type ApiMode = 'demo' | 'http';

/** Resposta do pedido de recuperação de senha — a mesma exista a conta ou não. */
export interface PasswordResetRequestResult {
  message: string;
  /** Validade do link enviado por e-mail, em minutos. */
  expiresInMinutes: number;
  /**
   * Apenas no modo demonstração, que não envia e-mails: o que seria enviado, para quem testa o fluxo.
   * null quando não haveria e-mail (nenhuma conta com o endereço neste navegador). Ausente no modo http.
   */
  simulatedEmail?: { to: string; subject: string; resetPath: string } | null;
}

export interface ApiClient {
  readonly mode: ApiMode;

  // Sessão e conta (UC01, UC02, RF20)
  getSession(): Promise<AccountState | null>;
  register(input: RegistrationInput): Promise<AccountState>;
  login(input: LoginInput): Promise<AccountState>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<PasswordResetRequestResult>;
  /** Situação do link de redefinição (válido, inválido, vencido ou já usado). */
  checkPasswordResetToken(token: string): Promise<ResetTokenStatus>;
  /** Define a senha nova. `sessionEnded`: a sessão deste navegador era da mesma conta e foi encerrada. */
  resetPassword(input: ResetPasswordInput): Promise<{ sessionEnded: boolean }>;
  deleteAccount(password: string): Promise<void>;
  /** Apenas no modo demonstração: entra (ou cria) a conta de exemplo. */
  startDemo?(): Promise<AccountState>;
  /**
   * Conta que a interface está exibindo. Chamadas privadas feitas para outra conta (ex.: login em
   * outra aba) são recusadas com UNAUTHENTICATED, para que dados de uma conta nunca apareçam na tela
   * de outra. Login, cadastro, demonstração, logout e exclusão atualizam o vínculo automaticamente.
   */
  bindSession(userId: string | null): void;

  // Perfil e preferências (UC03, UC12)
  saveProfile(input: ProfileInput): Promise<LearningProfile>;
  getPreferences(): Promise<Preferences>;
  updatePreferences(input: PreferencesInput): Promise<Preferences>;

  // Nivelamento (UC04)
  startPlacement(): Promise<PlacementStepView>;
  submitPlacement(answers: Record<string, string>): Promise<PlacementStepView>;
  skipPlacement(): Promise<PlacementResultView>;

  // Início e progresso (UC11)
  getHome(): Promise<HomeDashboard>;
  getProgress(): Promise<ProgressOverview>;

  // Modo Aprender (UC05–UC07)
  listLessons(): Promise<LessonSummary[]>;
  getLesson(lessonId: string): Promise<LessonView>;
  startLesson(lessonId: string): Promise<void>;
  answerExercise(lessonId: string, exerciseId: string, answer: string): Promise<ExerciseFeedback>;
  completeLesson(lessonId: string, timeSpentSeconds: number): Promise<LessonResult>;
  explainAgain(lessonId: string, attempt: number): Promise<{ text: string; language: 'pt' | 'en' }>;
  anotherExample(lessonId: string, attempt: number): Promise<Example>;

  // Modo Conversação (UC09)
  listTopics(): Promise<TopicView[]>;
  listConversations(): Promise<ConversationSummaryView[]>;
  startConversation(topicId: string): Promise<ConversationView>;
  getConversation(conversationId: string): Promise<ConversationView>;
  sendMessage(conversationId: string, text: string): Promise<SendMessageResult>;
  endConversation(conversationId: string): Promise<ConversationFeedbackView>;
  deleteConversation(conversationId: string): Promise<void>;
  deleteAllConversations(): Promise<number>;

  // Vocabulário (UC10)
  getVocabulary(): Promise<VocabularyOverview>;
  getWord(wordId: string): Promise<VocabularyItemView>;
  setWordStatus(wordId: string, status: VocabularyStatus): Promise<VocabularyItemView>;

  // Revisão (UC08)
  getReviews(): Promise<ReviewQueueView>;
  startReview(reviewId: string): Promise<ReviewSessionView>;
  answerReview(reviewId: string, exerciseId: string, answer: string): Promise<ExerciseFeedback>;
  completeReview(reviewId: string, result: { correct: number; total: number; timeSpentSeconds: number }): Promise<ReviewResult>;
}
