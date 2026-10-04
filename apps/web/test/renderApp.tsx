import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MemoryStorage, type KeyValueStorage } from '@english-ai/core';
import { AppProviders, createQueryClient } from '../src/app/App';
import { routes } from '../src/app/router';
import { createDemoClient } from '../src/services/demoClient';
import type { ApiClient } from '../src/services';

/** Cliente de demonstração isolado por teste e sem o atraso artificial da IA. */
export function createTestApi(storage: KeyValueStorage = new MemoryStorage()): ApiClient {
  return createDemoClient({ aiDelayMs: 0, storage });
}

/**
 * Renderiza o app completo (mesmos provedores do App real: cache, toasts, sessão, rotas e guardas)
 * em uma rota inicial. `initialEntries` permite simular histórico para testar o botão Voltar.
 */
export function renderApp(path: string | string[], api: ApiClient = createTestApi()) {
  const queryClient = createQueryClient();
  const entries = Array.isArray(path) ? path : [path];
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: entries.length - 1 });
  const user = userEvent.setup();
  const view = render(
    <AppProviders api={api} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { api, router, user, queryClient, view };
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
