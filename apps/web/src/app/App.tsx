import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Overlay';
import { ApiError, type ApiClient } from '../services';
import { createAppRouter } from './router';
import { SessionProvider } from './session';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Só falhas de rede podem melhorar sozinhas. Erros de domínio (sessão, não encontrado,
        // validação) não são repetidos — inclusive UNAUTHENTICATED, tratado pelo SessionProvider.
        retry: (count, error) => !(error instanceof ApiError && error.code !== 'NETWORK') && count < 2,
      },
    },
  });
}

/** Provedores do app (também usados nos testes, para que eles exercitem a mesma composição). */
export function AppProviders({ api, queryClient, children }: { api: ApiClient; queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider api={api}>{children}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function App({ api }: { api: ApiClient }) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  return (
    <AppProviders api={api} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
