/**
 * Implementação do DataStore sobre um armazenamento chave-valor (localStorage no navegador,
 * Map em testes). Usada pelo modo demonstração — volume pequeno, um JSON por coleção.
 */
import type { DataStore } from '../application/ports';
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

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

interface Collections {
  users: UserRecord;
  profiles: LearningProfile;
  preferences: Preferences;
  progress: Progress;
  attempts: ExerciseAttempt;
  userVocabulary: UserVocabulary;
  reviews: Review;
  conversations: Conversation;
  messages: Message;
  passwordResets: PasswordResetToken;
}

type CollectionName = keyof Collections;

const COLLECTIONS: CollectionName[] = [
  'users', 'profiles', 'preferences', 'progress', 'attempts', 'userVocabulary', 'reviews', 'conversations', 'messages',
  'passwordResets',
];

export function createDocumentStore(storage: KeyValueStorage, namespace = 'english-ai:v1'): DataStore {
  /**
   * Cache do último JSON lido de cada coleção. A leitura sempre confere o conteúdo atual do
   * armazenamento: se outra aba gravou algo, o cache é descartado. Sem isso, cada aba trabalharia
   * com uma cópia antiga e, ao gravar, apagaria o que a outra aba salvou.
   */
  const cache = new Map<CollectionName, { raw: string | null; rows: unknown[] }>();
  const key = (name: CollectionName) => `${namespace}:${name}`;

  function read<K extends CollectionName>(name: K): Collections[K][] {
    const raw = storage.getItem(key(name));
    const cached = cache.get(name);
    if (cached && cached.raw === raw) return cached.rows as Collections[K][];
    let parsed: Collections[K][] = [];
    try {
      parsed = raw ? (JSON.parse(raw) as Collections[K][]) : [];
    } catch {
      parsed = [];
    }
    cache.set(name, { raw, rows: parsed });
    return parsed;
  }

  function write<K extends CollectionName>(name: K, rows: Collections[K][]): void {
    const raw = JSON.stringify(rows);
    storage.setItem(key(name), raw);
    cache.set(name, { raw, rows });
  }

  function upsert<K extends CollectionName>(name: K, row: Collections[K], same: (a: Collections[K], b: Collections[K]) => boolean): void {
    const rows = read(name).filter((existing) => !same(existing, row));
    write(name, [...rows, structuredClone(row)]);
  }

  const clone = <T>(value: T): T => structuredClone(value);
  const one = <T>(value: T | undefined): T | null => (value ? clone(value) : null);

  return {
    users: {
      findById: async (id) => one(read('users').find((user) => user.id === id)),
      findByEmail: async (email) => one(read('users').find((user) => user.email === email)),
      create: async (user) => upsert('users', user, (a, b) => a.id === b.id),
      updatePassword: async (userId, passwordHash) =>
        write(
          'users',
          read('users').map((user) =>
            user.id === userId ? { ...user, passwordHash, sessionVersion: (user.sessionVersion ?? 0) + 1 } : user,
          ),
        ),
    },
    passwordResets: {
      create: async (token) => write('passwordResets', [...read('passwordResets'), clone(token)]),
      findByTokenHash: async (tokenHash) => one(read('passwordResets').find((token) => token.tokenHash === tokenHash)),
      latestForUser: async (userId) =>
        one(
          read('passwordResets')
            .filter((token) => token.userId === userId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
        ),
      markUsed: async (id, usedAt) => {
        const rows = read('passwordResets');
        const target = rows.find((token) => token.id === id);
        if (!target || target.usedAt) return false;
        write('passwordResets', rows.map((token) => (token.id === id ? { ...token, usedAt } : token)));
        return true;
      },
      deleteForUser: async (userId) => write('passwordResets', read('passwordResets').filter((token) => token.userId !== userId)),
      deleteExpired: async (beforeIso) => {
        const rows = read('passwordResets');
        const kept = rows.filter((token) => token.expiresAt >= beforeIso);
        if (kept.length !== rows.length) write('passwordResets', kept);
        return rows.length - kept.length;
      },
    },
    profiles: {
      get: async (userId) => one(read('profiles').find((profile) => profile.userId === userId)),
      save: async (profile) => upsert('profiles', profile, (a, b) => a.userId === b.userId),
    },
    preferences: {
      get: async (userId) => one(read('preferences').find((prefs) => prefs.userId === userId)),
      save: async (prefs) => upsert('preferences', prefs, (a, b) => a.userId === b.userId),
    },
    progress: {
      get: async (userId, lessonId) => one(read('progress').find((p) => p.userId === userId && p.lessonId === lessonId)),
      listByUser: async (userId) => clone(read('progress').filter((p) => p.userId === userId)),
      save: async (progress) => upsert('progress', progress, (a, b) => a.userId === b.userId && a.lessonId === b.lessonId),
    },
    attempts: {
      add: async (attempt) => write('attempts', [...read('attempts'), clone(attempt)]),
      listByUser: async (userId) => clone(read('attempts').filter((attempt) => attempt.userId === userId)),
    },
    userVocabulary: {
      listByUser: async (userId) => clone(read('userVocabulary').filter((item) => item.userId === userId)),
      get: async (userId, vocabularyId) =>
        one(read('userVocabulary').find((item) => item.userId === userId && item.vocabularyId === vocabularyId)),
      save: async (item) =>
        upsert('userVocabulary', item, (a, b) => a.userId === b.userId && a.vocabularyId === b.vocabularyId),
    },
    reviews: {
      listByUser: async (userId) => clone(read('reviews').filter((review) => review.userId === userId)),
      get: async (id) => one(read('reviews').find((review) => review.id === id)),
      save: async (review) => upsert('reviews', review, (a, b) => a.id === b.id),
    },
    conversations: {
      listByUser: async (userId) => clone(read('conversations').filter((c) => c.userId === userId)),
      get: async (id) => one(read('conversations').find((c) => c.id === id)),
      save: async (conversation) => upsert('conversations', conversation, (a, b) => a.id === b.id),
      listExpired: async (nowIso) =>
        clone(read('conversations').filter((c) => !c.contentDeletedAt && c.expiresAt !== null && c.expiresAt < nowIso)),
    },
    messages: {
      listByConversation: async (conversationId) =>
        clone(read('messages').filter((message) => message.conversationId === conversationId)).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      add: async (message) => write('messages', [...read('messages'), clone(message)]),
      deleteByConversation: async (conversationId) =>
        write('messages', read('messages').filter((message) => message.conversationId !== conversationId)),
    },
    async deleteUserData(userId) {
      const conversationIds = new Set(read('conversations').filter((c) => c.userId === userId).map((c) => c.id));
      write('messages', read('messages').filter((message) => !conversationIds.has(message.conversationId)));
      for (const name of COLLECTIONS) {
        if (name === 'messages') continue;
        const rows = read(name) as Array<{ userId?: string; id?: string }>;
        write(
          name,
          rows.filter((row) => (name === 'users' ? row.id !== userId : row.userId !== userId)) as Collections[typeof name][],
        );
      }
    },
  };
}
