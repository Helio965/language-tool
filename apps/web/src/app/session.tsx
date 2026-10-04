import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountState } from '@english-ai/core';
import { useToast } from '../components/Overlay';
import { ApiError, type ApiClient } from '../services';
import { isForeignUserQuery, isUserQuery, SESSION_KEY, userKeys, type UserKeys } from './queryKeys';

export { SESSION_KEY } from './queryKeys';

/**
 * Por que a sessão terminou. Define para onde as guardas de rota levam e qual mensagem aparece:
 * - signed_out: a pessoa clicou em "Sair" (aqui ou em outra aba) → /entrar, sem "sessão expirou";
 * - expired: o servidor/armazenamento deixou de reconhecer a sessão → /entrar com aviso e retorno à página;
 * - deleted: a conta foi excluída → página inicial.
 */
export type SessionEndReason = 'signed_out' | 'expired' | 'deleted';

interface SessionValue {
  /** Cliente de dados. Qualquer chamada privada que receba UNAUTHENTICATED revalida a sessão. */
  api: ApiClient;
  account: AccountState | null;
  /** Primeira verificação da sessão em andamento. */
  loading: boolean;
  /** A sessão não pôde ser verificada (ex.: sem conexão) e ainda não sabemos quem está conectado. */
  checkFailed: boolean;
  endReason: SessionEndReason | null;
  /** Após login, cadastro ou demonstração. */
  signIn: (account: AccountState) => void;
  /** Atualiza a conta exibida, só se `userId` ainda for a conta conectada (respostas tardias não ressuscitam sessões). */
  updateAccount: (userId: string, update: (account: AccountState) => AccountState) => void;
  /** Revalida a conta (perfil, nível, etapa pendente). Lança erro se não conseguir. */
  refresh: () => Promise<void>;
  /** Revalida a conta e todos os dados privados dela. Lança erro se a conta não puder ser revalidada. */
  refreshUserData: () => Promise<void>;
  /** Logout intencional. Lança erro se o servidor não confirmar (a pessoa continua conectada). */
  logout: () => Promise<void>;
  /** Encerra a sessão localmente (ex.: depois de excluir a conta). */
  endSession: (reason: SessionEndReason) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const CHANNEL_NAME = 'english-ai:session';

/** Métodos que não exigem sessão: um UNAUTHENTICATED neles não significa "sessão expirou". */
const PUBLIC_METHODS = new Set<PropertyKey>([
  'mode',
  'bindSession',
  'getSession',
  'register',
  'login',
  'logout',
  'requestPasswordReset',
  'checkPasswordResetToken',
  'resetPassword',
  'startDemo',
]);

/**
 * Envolve o cliente para avisar o SessionProvider de qualquer UNAUTHENTICATED (queries, mutations ou
 * chamadas diretas). Guarda a conta do momento da chamada: respostas atrasadas de outra conta são ignoradas.
 */
function guardApi(api: ApiClient, currentUserId: () => string | null, onUnauthenticated: (callerId: string | null) => void): ApiClient {
  return new Proxy(api, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || PUBLIC_METHODS.has(property)) return value;
      return (...args: unknown[]) => {
        const callerId = currentUserId();
        return (value as (...params: unknown[]) => Promise<unknown>).apply(target, args).catch((error: unknown) => {
          if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') onUnauthenticated(callerId);
          throw error;
        });
      };
    },
  });
}

export function SessionProvider({ api: client, children }: { api: ApiClient; children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  /** Motivo avisado por outra aba; usado quando esta aba descobrir que a sessão acabou. */
  const remoteReason = useRef<SessionEndReason | null>(null);
  const checking = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const currentAccount = useCallback(() => queryClient.getQueryData<AccountState | null>(SESSION_KEY) ?? null, [queryClient]);

  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const account = await client.getSession();
      client.bindSession(account?.user.id ?? null);
      if (account) setEndReason(null);
      else if (currentAccount()) setEndReason(remoteReason.current ?? 'expired');
      remoteReason.current = null;
      return account;
    },
    // A sessão não fica "velha" sozinha: ela é revalidada quando algo indica mudança
    // (UNAUTHENTICATED em qualquer chamada, aviso de outra aba ou volta à aba).
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
  });

  const notifyOtherTabs = useCallback((reason?: SessionEndReason) => {
    channel.current?.postMessage({ type: 'session-changed', reason });
  }, []);

  const endSession = useCallback(
    (reason: SessionEndReason) => {
      client.bindSession(null);
      setEndReason(reason);
      // Requisições privadas em andamento não podem mais gravar no cache.
      void queryClient.cancelQueries({ predicate: isUserQuery });
      // A query da sessão continua no cache (o provider a observa): só o valor muda.
      // As guardas desmontam as telas privadas; o efeito abaixo remove os dados delas.
      queryClient.setQueryData(SESSION_KEY, null);
      notifyOtherTabs(reason);
      if (reason === 'signed_out') toast('Você saiu da sua conta.', 'info');
      if (reason === 'deleted') toast('Sua conta e seus dados foram excluídos.', 'info');
    },
    [client, queryClient, notifyOtherTabs, toast],
  );

  const signIn = useCallback(
    (account: AccountState) => {
      client.bindSession(account.user.id);
      remoteReason.current = null;
      setEndReason(null);
      queryClient.setQueryData(SESSION_KEY, account);
      notifyOtherTabs();
    },
    [client, queryClient, notifyOtherTabs],
  );

  const handleUnauthenticated = useCallback(
    (callerId: string | null) => {
      const before = currentAccount();
      // Visitante, ou resposta atrasada de outra conta: ignorada (sem falso "sessão expirou").
      if (!before || before.user.id !== callerId || checking.current) return;
      checking.current = true;
      void (async () => {
        try {
          const account = await client.getSession();
          if (account && account.user.id !== before.user.id) {
            // Outra conta entrou neste navegador: troca a identidade (os dados da anterior são descartados).
            signIn(account);
            return;
          }
        } catch {
          // Sem como confirmar: o servidor já recusou a chamada, então a sessão é tratada como encerrada.
        } finally {
          checking.current = false;
        }
        if (currentAccount()?.user.id === before.user.id) endSession('expired');
      })();
    },
    [client, currentAccount, endSession, signIn],
  );

  const api = useMemo(
    () => guardApi(client, () => currentAccount()?.user.id ?? null, handleUnauthenticated),
    [client, currentAccount, handleUnauthenticated],
  );

  // Remove dados privados de qualquer conta que não seja a atual: logout, expiração,
  // exclusão ou troca de conta. Roda depois que as telas da conta anterior desmontaram.
  const accountId = session.data?.user.id ?? null;
  const previousAccountId = useRef<string | null>(null);
  useEffect(() => {
    const isForeign = (query: Parameters<typeof isUserQuery>[0]) => isForeignUserQuery(query, accountId);
    void queryClient.cancelQueries({ predicate: isForeign });
    queryClient.removeQueries({ predicate: isForeign });
    if (previousAccountId.current && previousAccountId.current !== accountId) queryClient.getMutationCache().clear();
    previousAccountId.current = accountId;
  }, [accountId, queryClient]);

  // Sincroniza abas do mesmo navegador (login, logout ou exclusão em outra aba).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<{ type?: string; reason?: SessionEndReason }>) => {
      if (event.data?.type !== 'session-changed') return;
      const reason = event.data.reason;
      remoteReason.current = reason === 'signed_out' || reason === 'deleted' ? reason : null;
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    };
    return () => {
      bc.close();
      channel.current = null;
    };
  }, [queryClient]);

  const updateAccount = useCallback(
    (userId: string, update: (account: AccountState) => AccountState) => {
      queryClient.setQueryData<AccountState | null>(SESSION_KEY, (account) => (account && account.user.id === userId ? update(account) : account));
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SESSION_KEY }, { throwOnError: true });
  }, [queryClient]);

  const refreshUserData = useCallback(async () => {
    const id = currentAccount()?.user.id;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SESSION_KEY }, { throwOnError: true }),
      // Falhas nos dados privados aparecem nas próprias telas (com "Tentar de novo").
      id ? queryClient.invalidateQueries({ queryKey: userKeys(id).all }) : Promise.resolve(),
    ]);
  }, [queryClient, currentAccount]);

  const logout = useCallback(async () => {
    await client.logout();
    endSession('signed_out');
  }, [client, endSession]);

  const value = useMemo<SessionValue>(
    () => ({
      api,
      account: session.data ?? null,
      loading: session.isLoading,
      checkFailed: session.isError && session.data === undefined,
      endReason,
      signIn,
      updateAccount,
      refresh,
      refreshUserData,
      logout,
      endSession,
    }),
    [api, session.data, session.isLoading, session.isError, endReason, signIn, updateAccount, refresh, refreshUserData, logout, endSession],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** Atalho para a conta autenticada (as rotas protegidas garantem que existe). */
export function useAccount(): AccountState {
  const { account } = useSession();
  if (!account) throw new Error('No authenticated account');
  return account;
}

export function useApi(): ApiClient {
  return useSession().api;
}

/** Chaves de cache dos dados privados da conta conectada. */
export function useUserKeys(): UserKeys {
  const { user } = useAccount();
  return useMemo(() => userKeys(user.id), [user.id]);
}

export function pathForStep(step: AccountState['nextStep']): string {
  if (step === 'onboarding') return '/configuracao';
  if (step === 'placement') return '/nivelamento';
  return '/inicio';
}

/** Só aceita caminhos internos como destino após o login (evita redirecionamentos para fora). */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/^\/(entrar|cadastro|recuperar-senha)?(\?|$)/.test(value) || value.startsWith('/redefinir-senha/')) return null;
  return value;
}
