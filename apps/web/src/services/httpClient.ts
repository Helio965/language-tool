import type { ApiClient } from './apiClient';
import { ApiError } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Cliente da API REST. O token de sessão fica em cookie httpOnly, invisível ao JavaScript. */
export function createHttpClient(baseUrl = '/api'): ApiClient {
  async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          // Cabeçalho exigido pela proteção CSRF da API.
          'X-Requested-With': 'english-ai',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
    }
    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
    if (!response.ok) {
      const error = data?.error;
      throw new ApiError((error?.code as ApiError['code']) ?? 'INTERNAL', error?.message ?? 'Algo deu errado. Tente novamente.', error?.fields ?? {});
    }
    return data as T;
  }

  return {
    mode: 'http',
    async getSession() {
      try {
        return await call('GET', '/me');
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return null;
        throw error;
      }
    },
    register: (input) => call('POST', '/auth/register', input),
    login: (input) => call('POST', '/auth/login', input),
    logout: () => call('POST', '/auth/logout'),
    requestPasswordReset: async (email) => (await call<{ message: string }>('POST', '/auth/password-reset', { email })).message,
    deleteAccount: (password) => call('DELETE', '/me', { password }),

    saveProfile: (input) => call('PUT', '/me/profile', input),
    getPreferences: () => call('GET', '/me/preferences'),
    updatePreferences: (input) => call('PATCH', '/me/preferences', input),

    startPlacement: () => call('POST', '/placement/start'),
    submitPlacement: (answers) => call('POST', '/placement/answers', { answers }),
    skipPlacement: () => call('POST', '/placement/skip'),

    getHome: () => call('GET', '/home'),
    getProgress: () => call('GET', '/progress'),

    listLessons: () => call('GET', '/lessons'),
    getLesson: (id) => call('GET', `/lessons/${encodeURIComponent(id)}`),
    startLesson: (id) => call('POST', `/lessons/${encodeURIComponent(id)}/start`),
    answerExercise: (lessonId, exerciseId, answer) =>
      call('POST', `/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exerciseId)}/answer`, { answer }),
    completeLesson: (id, timeSpentSeconds) => call('POST', `/lessons/${encodeURIComponent(id)}/complete`, { timeSpentSeconds }),
    explainAgain: (id, attempt) => call('POST', `/lessons/${encodeURIComponent(id)}/explain`, { attempt }),
    anotherExample: (id, attempt) => call('POST', `/lessons/${encodeURIComponent(id)}/example`, { attempt }),

    listTopics: () => call('GET', '/conversation-topics'),
    listConversations: () => call('GET', '/conversations'),
    startConversation: (topicId) => call('POST', '/conversations', { topicId }),
    getConversation: (id) => call('GET', `/conversations/${encodeURIComponent(id)}`),
    sendMessage: (id, text) => call('POST', `/conversations/${encodeURIComponent(id)}/messages`, { text }),
    endConversation: (id) => call('POST', `/conversations/${encodeURIComponent(id)}/end`),
    deleteConversation: (id) => call('DELETE', `/conversations/${encodeURIComponent(id)}`),
    deleteAllConversations: async () => (await call<{ deleted: number }>('DELETE', '/conversations')).deleted,

    getVocabulary: () => call('GET', '/vocabulary'),
    getWord: (id) => call('GET', `/vocabulary/${encodeURIComponent(id)}`),
    setWordStatus: (id, status) => call('PUT', `/vocabulary/${encodeURIComponent(id)}/status`, { status }),

    getReviews: () => call('GET', '/reviews'),
    startReview: (id) => call('POST', `/reviews/${encodeURIComponent(id)}/session`),
    answerReview: (id, exerciseId, answer) => call('POST', `/reviews/${encodeURIComponent(id)}/answers`, { exerciseId, answer }),
    completeReview: (id, result) => call('POST', `/reviews/${encodeURIComponent(id)}/complete`, result),
  };
}
