import type { Query } from '@tanstack/react-query';

/**
 * Chaves do TanStack Query.
 *
 * - `SESSION_KEY` guarda a conta autenticada (ou `null` para visitantes). Ela nunca é removida
 *   do cache: o SessionProvider a observa durante toda a vida do app.
 * - Todo dado privado fica sob `['user', userId, ...]`. Assim, dados de uma conta nunca podem
 *   aparecer para outra (as chaves são diferentes) e a limpeza na troca de identidade é exata.
 */
export const SESSION_KEY = ['session'] as const;

const USER_SCOPE = 'user';

export function userKeys(userId: string) {
  const all = [USER_SCOPE, userId] as const;
  return {
    all,
    home: [...all, 'home'] as const,
    progress: [...all, 'progress'] as const,
    lessons: [...all, 'lessons'] as const,
    lesson: (lessonId: string) => [...all, 'lesson', lessonId] as const,
    reviews: [...all, 'reviews'] as const,
    reviewSession: (reviewId: string) => [...all, 'review-session', reviewId] as const,
    topics: [...all, 'topics'] as const,
    conversations: [...all, 'conversations'] as const,
    conversation: (conversationId: string) => [...all, 'conversation', conversationId] as const,
    vocabulary: [...all, 'vocabulary'] as const,
  };
}

export type UserKeys = ReturnType<typeof userKeys>;

/** Query privada (pertence a alguma conta). */
export function isUserQuery(query: Query): boolean {
  return query.queryKey[0] === USER_SCOPE;
}

/** Query privada de uma conta diferente de `userId` (ou de qualquer conta, se `userId` for null). */
export function isForeignUserQuery(query: Query, userId: string | null): boolean {
  return isUserQuery(query) && query.queryKey[1] !== userId;
}
