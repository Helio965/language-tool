import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Overlay';
import { ApiError, type ApiClient } from '../services';
import { createAppRouter } from './router';
import { SessionProvider } from './session';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Erros de domínio (ex.: não encontrado) não melhoram com nova tentativa.
        retry: (count, error) => !(error instanceof ApiError && error.code !== 'NETWORK') && count < 2,
      },
    },
  });
}

export function App({ api }: { api: ApiClient }) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider api={api}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
