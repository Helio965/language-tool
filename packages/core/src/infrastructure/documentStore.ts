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
}

type CollectionName = keyof Collections;

const COLLECTIONS: CollectionName[] = [
  'users', 'profiles', 'preferences', 'progress', 'attempts', 'userVocabulary', 'reviews', 'conversations', 'messages',
];

export function createDocumentStore(storage: KeyValueStorage, namespace = 'english-ai:v1'): DataStore {
  const cache = new Map<CollectionName, unknown[]>();
  const key = (name: CollectionName) => `${namespace}:${name}`;

  function read<K extends CollectionName>(name: K): Collections[K][] {
    if (!cache.has(name)) {
      let parsed: Collections[K][] = [];
      try {
        const raw = storage.getItem(key(name));
        parsed = raw ? (JSON.parse(raw) as Collections[K][]) : [];
      } catch {
        parsed = [];
      }
      cache.set(name, parsed);
    }
    return cache.get(name) as Collections[K][];
  }

  function write<K extends CollectionName>(name: K, rows: Collections[K][]): void {
    cache.set(name, rows);
    storage.setItem(key(name), JSON.stringify(rows));
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
