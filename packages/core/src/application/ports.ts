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
}
