import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MemoryStorage } from '@english-ai/core';
import { routes } from '../src/app/router';
import { SessionProvider } from '../src/app/session';
import { ToastProvider } from '../src/components/Overlay';
import { createDemoClient } from '../src/services/demoClient';
import type { ApiClient } from '../src/services';

/** Cliente de demonstração isolado por teste e sem o atraso artificial da IA. */
export function createTestApi(): ApiClient {
  return createDemoClient({ aiDelayMs: 0, storage: new MemoryStorage() });
}

/** Renderiza o app completo (rotas, guards, sessão) em uma rota inicial. */
export function renderApp(path: string, api: ApiClient = createTestApi()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider api={api}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { api, router, user };
}

/** Conta pronta para usar o app (perfil salvo e nivelamento pulado). */
export async function createReadyAccount(api: ApiClient = createTestApi()): Promise<ApiClient> {
  await api.register({
    name: 'Bia',
    email: 'bia@example.com',
    password: 'segura123',
    passwordConfirmation: 'segura123',
    acceptedTerms: true,
  });
  await api.saveProfile({
    goal: 'conversation',
    perceivedLevel: 'basic',
    priorExperience: 'school',
    conversationInterest: true,
    professionalInterest: false,
    interestAreas: ['travel'],
  });
  await api.skipPlacement();
  return api;
}
