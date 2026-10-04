import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { AccountState } from '@english-ai/core';
import type { ApiClient } from '../services';

interface SessionValue {
  api: ApiClient;
  account: AccountState | null;
  loading: boolean;
  /** Atualiza a conta após login/cadastro/alterações de perfil. */
  setAccount: (account: AccountState | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const SESSION_KEY = ['session'] as const;

export function SessionProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: SESSION_KEY, queryFn: () => api.getSession(), staleTime: Infinity });

  const setAccount = useCallback(
    (account: AccountState | null) => {
      queryClient.setQueryData(SESSION_KEY, account);
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.logout();
    queryClient.clear();
    queryClient.setQueryData(SESSION_KEY, null);
  }, [api, queryClient]);

  const value = useMemo<SessionValue>(
    () => ({ api, account: data ?? null, loading: isLoading, setAccount, refresh, logout }),
    [api, data, isLoading, setAccount, refresh, logout],
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

export function pathForStep(step: AccountState['nextStep']): string {
  if (step === 'onboarding') return '/configuracao';
  if (step === 'placement') return '/nivelamento';
  return '/inicio';
}
