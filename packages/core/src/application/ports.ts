/**
 * Portas (interfaces) de persistência e infraestrutura. A API implementa com SQLite;
 * o modo demonstração implementa com armazenamento local do navegador.
 * Interfaces assíncronas permitem migrar para PostgreSQL ou outro banco sem mudar os casos de uso.
 */
import type { ContentCatalog } from '../content/catalog';
import type {
  Conversation,
  ExerciseAttempt,
  LearningProfile,
  Message,
  PasswordResetToken,
  Preferences,
  Progress,
  Review,
  UserRecord,
  UserVocabulary,
} from '../domain/entities';
import type { AIService } from '../ai/types';

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(user: UserRecord): Promise<void>;
  /** Troca o hash da senha e invalida as sessões abertas (incrementa `sessionVersion`). */
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

export interface PasswordResetRepository {
  create(token: PasswordResetToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  /** Pedido mais recente da conta (para limitar o reenvio de e-mails). */
  latestForUser(userId: string): Promise<PasswordResetToken | null>;
  /** Marca como usado só se ainda não foi usado; retorna false se outro pedido chegou antes (uso único). */
  markUsed(id: string, usedAt: string): Promise<boolean>;
  /** Remove todos os pedidos da conta (links anteriores deixam de funcionar). */
  deleteForUser(userId: string): Promise<void>;
  /** Limpeza periódica: remove pedidos vencidos antes da data informada. Retorna quantos removeu. */
  deleteExpired(beforeIso: string): Promise<number>;
}

export interface ProfileRepository {
  get(userId: string): Promise<LearningProfile | null>;
  save(profile: LearningProfile): Promise<void>;
}

export interface PreferencesRepository {
  get(userId: string): Promise<Preferences | null>;
  save(preferences: Preferences): Promise<void>;
}

export interface ProgressRepository {
  get(userId: string, lessonId: string): Promise<Progress | null>;
  listByUser(userId: string): Promise<Progress[]>;
  save(progress: Progress): Promise<void>;
}

export interface AttemptRepository {
  add(attempt: ExerciseAttempt): Promise<void>;
  listByUser(userId: string): Promise<ExerciseAttempt[]>;
}

export interface UserVocabularyRepository {
  listByUser(userId: string): Promise<UserVocabulary[]>;
  get(userId: string, vocabularyId: string): Promise<UserVocabulary | null>;
  save(item: UserVocabulary): Promise<void>;
}

export interface ReviewRepository {
  listByUser(userId: string): Promise<Review[]>;
  get(id: string): Promise<Review | null>;
  save(review: Review): Promise<void>;
}

export interface ConversationRepository {
  listByUser(userId: string): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  /** Conversas com conteúdo ainda armazenado e prazo de retenção vencido. */
  listExpired(nowIso: string): Promise<Conversation[]>;
}

export interface MessageRepository {
  listByConversation(conversationId: string): Promise<Message[]>;
  add(message: Message): Promise<void>;
  deleteByConversation(conversationId: string): Promise<void>;
}

export interface DataStore {
  users: UserRepository;
  profiles: ProfileRepository;
  preferences: PreferencesRepository;
  progress: ProgressRepository;
  attempts: AttemptRepository;
  userVocabulary: UserVocabularyRepository;
  reviews: ReviewRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  passwordResets: PasswordResetRepository;
  /** Exclusão completa dos dados do usuário (RF20 / LGPD). */
  deleteUserData(userId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface AppDependencies {
  store: DataStore;
  catalog: ContentCatalog;
  ai: AIService;
  passwordHasher: PasswordHasher;
  now?: () => Date;
  generateId?: () => string;
  /** Fuso usado para "dias de estudo" (público principal: Brasil). */
  timeZone?: string;
  conversationRetentionDays?: number;
  maxHistoryMessages?: number;
  /** Validade do link de redefinição de senha, em minutos (padrão: 15). */
  passwordResetTtlMinutes?: number;
}
