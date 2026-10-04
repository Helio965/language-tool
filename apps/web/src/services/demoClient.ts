/**
 * Modo DEMONSTRAÇÃO: os mesmos casos de uso do core rodando no navegador.
 * Dados ficam apenas no localStorage deste navegador; a IA é a de demonstração (sem chave, sem custo).
 * Não é autenticação de produção — serve para navegar e validar o protótipo.
 */
import {
  AppError,
  PASSWORD_RESET_REQUESTED_MESSAGE,
  createAppServices,
  type AccountState,
  createDocumentStore,
  createStaticCatalog,
  MockAIService,
  Pbkdf2PasswordHasher,
  type AppServices,
  type KeyValueStorage,
  type PasswordHasher,
} from '@english-ai/core';
import { DEMO_ACCOUNT, seedDemoAccount } from '../mocks/demoSeed';
import type { ApiClient } from './apiClient';
import { toApiError } from './errors';

const NAMESPACE = 'english-ai:v1';
const SESSION_KEY = `${NAMESPACE}:session`;
/** Atraso simulado das chamadas de IA, para que o estado "IA está preparando…" seja visível. */
const AI_DELAY_MS = 750;

function safeStorage(): KeyValueStorage {
  try {
    const probe = `${NAMESPACE}:probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}

function generateId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Em contexto não seguro (ex.: celular acessando http://IP-da-máquina), o navegador não oferece
 * Web Crypto. Para o protótipo continuar navegável, usamos um hash simples — apenas demonstração.
 */
class PrototypeOnlyHasher implements PasswordHasher {
  private digest(value: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < value.length; i++) {
      const ch = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
  }
  async hash(password: string): Promise<string> {
    const salt = generateId();
    return `demo$${salt}$${this.digest(salt + password)}`;
  }
  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, salt, hash] = stored.split('$');
    return scheme === 'demo' && Boolean(salt) && this.digest(`${salt}${password}`) === hash;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDemoClient(options: { aiDelayMs?: number; storage?: KeyValueStorage } = {}): ApiClient {
  const storage = options.storage ?? safeStorage();
  const aiDelay = options.aiDelayMs ?? AI_DELAY_MS;
  const catalog = createStaticCatalog();
  const store = createDocumentStore(storage, NAMESPACE);
  const ai = new MockAIService(catalog);
  const passwordHasher: PasswordHasher = globalThis.crypto?.subtle ? new Pbkdf2PasswordHasher(120_000) : new PrototypeOnlyHasher();
  const services: AppServices = createAppServices({ store, catalog, ai, passwordHasher, generateId });

  /** Conta exibida pela interface (ver ApiClient.bindSession). */
  let boundUserId: string | null = null;

  const currentUser = (): string => {
    const id = storage.getItem(SESSION_KEY);
    // Sem sessão, ou a sessão salva já é de outra conta (ex.: login em outra aba).
    if (!id || id !== boundUserId) throw new AppError('UNAUTHENTICATED', 'Sem sessão.');
    return id;
  };

  const signIn = (account: AccountState): AccountState => {
    storage.setItem(SESSION_KEY, account.user.id);
    boundUserId = account.user.id;
    return account;
  };

  /** Executa um caso de uso convertendo erros para o formato da interface. */
  async function run<T>(work: () => Promise<T>, delay = 0): Promise<T> {
    try {
      const [result] = await Promise.all([work(), delay ? wait(delay) : Promise.resolve()]);
      return result;
    } catch (error) {
      throw toApiError(error);
    }
  }
  const withUser = <T>(work: (userId: string) => Promise<T>, delay = 0) => run(() => work(currentUser()), delay);

  return {
    mode: 'demo',
    bindSession: (userId) => {
      boundUserId = userId;
    },

    async getSession() {
      const id = storage.getItem(SESSION_KEY);
      if (!id) return null;
      try {
        await services.conversation.purgeExpired();
        return await services.auth.getAccount(id);
      } catch {
        storage.removeItem(SESSION_KEY);
        return null;
      }
    },
    register: (input) => run(async () => signIn(await services.auth.register(input))),
    login: (input) => run(async () => signIn(await services.auth.login(input))),
    logout: async () => {
      storage.removeItem(SESSION_KEY);
      boundUserId = null;
    },
    /**
     * A demonstração não envia e-mails: o pedido é registrado com as mesmas regras da API e a tela
     * mostra, identificado como simulação, o e-mail que seria enviado.
     */
    requestPasswordReset: (email) =>
      run(async () => {
        const request = await services.passwordReset.requestReset(email);
        return {
          message: PASSWORD_RESET_REQUESTED_MESSAGE,
          expiresInMinutes: services.passwordReset.ttlMinutes,
          simulatedEmail: request
            ? { to: request.user.email, subject: 'Redefinição de senha — English AI', resetPath: `/redefinir-senha/${request.token}` }
            : null,
        };
      }),
    checkPasswordResetToken: (token) => run(() => services.passwordReset.checkToken(token)),
    resetPassword: (input) =>
      run(async () => {
        const { userId } = await services.passwordReset.resetPassword(input);
        // Como na API: a sessão salva neste navegador, se for da mesma conta, deixa de valer.
        const sessionEnded = storage.getItem(SESSION_KEY) === userId;
        if (sessionEnded) {
          storage.removeItem(SESSION_KEY);
          boundUserId = null;
        }
        return { sessionEnded };
      }),
    deleteAccount: (password) =>
      withUser(async (userId) => {
        await services.auth.deleteAccount(userId, password);
        storage.removeItem(SESSION_KEY);
        boundUserId = null;
      }),
    startDemo: () =>
      run(async () => {
        const existing = await store.users.findByEmail(DEMO_ACCOUNT.email);
        if (!existing) await seedDemoAccount({ store, catalog, ai, passwordHasher, generateId });
        return signIn(await services.auth.login({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }));
      }),

    saveProfile: (input) => withUser((id) => services.profile.saveProfile(id, input)),
    getPreferences: () => withUser((id) => services.profile.getPreferences(id)),
    updatePreferences: (input) => withUser((id) => services.profile.updatePreferences(id, input)),

    startPlacement: () => withUser((id) => services.placement.start(id)),
    submitPlacement: (answers) => withUser((id) => services.placement.submit(id, answers), 400),
    skipPlacement: () => withUser((id) => services.placement.skip(id)),

    getHome: () => withUser((id) => services.progress.home(id)),
    getProgress: () => withUser((id) => services.progress.overview(id)),

    listLessons: () => withUser((id) => services.learning.listLessons(id)),
    getLesson: (lessonId) => withUser((id) => services.learning.getLesson(id, lessonId)),
    startLesson: (lessonId) => withUser((id) => services.learning.startLesson(id, lessonId)),
    answerExercise: (lessonId, exerciseId, answer) => {
      const isOpen = catalog.exercise(exerciseId)?.exercise.type === 'write';
      return withUser((id) => services.learning.checkAnswer(id, lessonId, exerciseId, answer), isOpen ? aiDelay : 0);
    },
    completeLesson: (lessonId, seconds) => withUser((id) => services.learning.completeLesson(id, lessonId, seconds)),
    explainAgain: (lessonId, attempt) => withUser((id) => services.learning.explainAgain(id, lessonId, attempt), aiDelay),
    anotherExample: (lessonId, attempt) => withUser((id) => services.learning.anotherExample(id, lessonId, attempt), aiDelay / 2),

    listTopics: () => withUser((id) => services.conversation.listTopics(id)),
    listConversations: () => withUser((id) => services.conversation.list(id)),
    startConversation: (topicId) => withUser((id) => services.conversation.start(id, topicId), aiDelay),
    getConversation: (conversationId) => withUser((id) => services.conversation.get(id, conversationId)),
    sendMessage: (conversationId, text) => withUser((id) => services.conversation.send(id, conversationId, text), aiDelay),
    endConversation: (conversationId) => withUser((id) => services.conversation.end(id, conversationId)),
    deleteConversation: (conversationId) => withUser((id) => services.conversation.remove(id, conversationId)),
    deleteAllConversations: () => withUser((id) => services.conversation.removeAll(id)),

    getVocabulary: () => withUser((id) => services.vocabulary.list(id)),
    getWord: (wordId) => withUser((id) => services.vocabulary.get(id, wordId)),
    setWordStatus: (wordId, status) => withUser((id) => services.vocabulary.setStatus(id, wordId, status)),

    getReviews: () => withUser((id) => services.review.queue(id)),
    startReview: (reviewId) => withUser((id) => services.review.startSession(id, reviewId)),
    answerReview: (reviewId, exerciseId, answer) => withUser((id) => services.review.answer(id, reviewId, exerciseId, answer)),
    completeReview: (reviewId, result) => withUser((id) => services.review.complete(id, reviewId, result)),
  };
}
