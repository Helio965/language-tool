import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@english-ai/core';
import { ApiError, type ApiClient } from '../src/services';
import { createReadyAccount, createTestApi, renderApp } from './renderApp';

const DEMO_EMAIL = 'alex@demo.englishai.app';

/** O diálogo aberto (páginas podem ter vários diálogos fechados). */
function openDialog(): HTMLElement {
  const dialog = screen.getAllByRole('dialog', { hidden: true }).find((element) => (element as HTMLDialogElement).open);
  if (!dialog) throw new Error('Nenhum diálogo aberto');
  return dialog;
}

/** Ids de conta presentes em dados privados no cache (['user', id, ...]). */
function cachedUserIds(queryClient: ReturnType<typeof renderApp>['queryClient']): string[] {
  const ids = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.queryKey[0] === 'user')
    .map((query) => String(query.queryKey[1]));
  return [...new Set(ids)];
}

async function signUp(user: ReturnType<typeof renderApp>['user'], name: string, email: string) {
  await user.type(await screen.findByLabelText('Nome'), name);
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), 'segura123');
  await user.type(screen.getByLabelText('Confirme a senha'), 'segura123');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

async function signIn(user: ReturnType<typeof renderApp>['user'], email: string, password = 'segura123') {
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

async function signOutFromProfile(user: ReturnType<typeof renderApp>['user'], router: ReturnType<typeof renderApp>['router']) {
  await router.navigate('/perfil');
  await user.click(await screen.findByRole('button', { name: 'Sair da conta' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
}

/** Configuração inicial + "Prefiro começar do zero" no nivelamento. */
async function finishFirstAccess(user: ReturnType<typeof renderApp>['user'], router: ReturnType<typeof renderApp>['router']) {
  await screen.findByRole('heading', { name: /principal objetivo/ });
  await user.click(screen.getByText('Conversar', { selector: 'span' }));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.click(screen.getByText('Básico', { selector: 'span' }));
  await user.click(screen.getByRole('button', { name: 'Estudei na escola' }));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.click(screen.getByRole('button', { name: /Salvar e fazer o nivelamento/ }));
  await user.click(await screen.findByRole('button', { name: 'Prefiro começar do zero' }));
  await user.click(await screen.findByRole('button', { name: 'Ir para o início' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
}

describe('Logout intencional (regressão do bug "Sair da conta")', () => {
  it('TESTE 1/2 — Alex → Perfil → Sair: vira visitante, vai ao login, sem "sessão expirou"', async () => {
    const api = createTestApi();
    await api.startDemo!();
    const { user, router, queryClient } = renderApp('/perfil', api);

    await user.click(await screen.findByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(await screen.findByText('Você saiu da sua conta.')).toBeInTheDocument();
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(cachedUserIds(queryClient)).toEqual([]));

    // Rota protegida depois do logout → login (e nada privado é renderizado).
    await router.navigate('/progresso');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();
  });

  it('o botão Voltar depois do logout não revela dados privados', async () => {
    const api = createTestApi();
    await api.startDemo!();
    const { user, router } = renderApp(['/inicio', '/progresso', '/perfil'], api);
    await user.click(await screen.findByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(screen.queryByRole('heading', { name: 'Seu progresso' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();
  });

  it('Explorar demonstração funciona de novo depois de sair', async () => {
    const api = createTestApi();
    await api.startDemo!();
    const { user, router } = renderApp('/perfil', api);
    await user.click(await screen.findByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));

    await router.navigate('/');
    await user.click(await screen.findByRole('button', { name: /Explorar demonstração/ }));
    expect(await screen.findByRole('heading', { level: 1, name: /Alex/ })).toBeInTheDocument();
  });
});

describe('Sessão expirada de verdade', () => {
  it('TESTE 3 — uma única transição para o login, uma mensagem e retorno à página', async () => {
    const storage = new MemoryStorage();
    const api = createTestApi(storage);
    await api.startDemo!();
    const { user, router } = renderApp('/inicio', api);
    await screen.findByRole('heading', { level: 1, name: /Alex/ });

    // A sessão deixa de existir "por fora" (expirou / foi encerrada em outro lugar).
    storage.removeItem('english-ai:v1:session');
    await router.navigate('/conversar');

    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(await screen.findAllByText('Sua sessão expirou. Entre novamente para continuar.')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();

    await signIn(user, DEMO_EMAIL, 'demo1234');
    await waitFor(() => expect(router.state.location.pathname).toBe('/conversar'));
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
  });

  it('TESTE 4 — UNAUTHENTICATED não oferece "Tentar de novo"', async () => {
    const api = await createReadyAccount();
    const failing: ApiClient = new Proxy(api, {
      get(target, property, receiver) {
        if (property === 'getProgress') return () => Promise.reject(new ApiError('UNAUTHENTICATED', 'Sessão expirada.'));
        return Reflect.get(target, property, receiver);
      },
    });
    const { router } = renderApp('/progresso', failing);
    // O SessionProvider revalida a sessão; como o servidor recusou a chamada, ela é encerrada → login.
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(await screen.findAllByText('Sua sessão expirou. Entre novamente para continuar.')).toHaveLength(1);
  });

  it('TESTE 15 — erro de rede: "Tentar de novo" carrega os dados', async () => {
    const api = await createReadyAccount();
    let failures = 3; // a tentativa inicial + 2 repetições automáticas para erros de rede
    const flaky: ApiClient = new Proxy(api, {
      get(target, property, receiver) {
        if (property === 'getProgress') {
          return () => (failures-- > 0 ? Promise.reject(new ApiError('NETWORK', 'Sem conexão com o servidor.')) : target.getProgress());
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { user } = renderApp('/progresso', flaky);
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 8000 });
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    await user.click(retry);
    expect(await screen.findByText('Nada por aqui ainda')).toBeInTheDocument();
  }, 15000);
});

describe('Troca de conta sem vazamento de dados', () => {
  it('TESTE 5 — Alex → sair → nova conta → Perfil mostra a conta nova', async () => {
    const api = createTestApi();
    await api.startDemo!();
    const { user, router } = renderApp('/perfil', api);
    await screen.findByText(DEMO_EMAIL);
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));

    await router.navigate('/cadastro');
    await signUp(user, 'Maria', 'maria@example.com');
    await finishFirstAccess(user, router);
    await router.navigate('/perfil');

    expect(await screen.findByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Maria' })).toBeInTheDocument();
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();

    // Sair e entrar de novo mantém os dados certos.
    await signOutFromProfile(user, router);
    await signIn(user, 'maria@example.com');
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    expect(await screen.findByRole('heading', { level: 1, name: /Maria/ })).toBeInTheDocument();
  });

  it('TESTE 6 — conta A estuda; conta B não vê nada de A; A volta com seus dados', async () => {
    const api = createTestApi();
    await api.startDemo!(); // A = Alex, com progresso de exemplo
    const { user, router, queryClient } = renderApp('/progresso', api);
    expect(await screen.findByText('Aulas concluídas')).toBeInTheDocument();
    const alexIds = cachedUserIds(queryClient);
    expect(alexIds).toHaveLength(1);

    await signOutFromProfile(user, router);
    await router.navigate('/cadastro');
    await signUp(user, 'Bia', 'bia@example.com');
    await finishFirstAccess(user, router);

    await router.navigate('/progresso');
    expect(await screen.findByText('Nada por aqui ainda')).toBeInTheDocument();
    await router.navigate('/vocabulario');
    expect(await screen.findByText('Seu vocabulário começa na primeira aula')).toBeInTheDocument();
    await router.navigate('/conversar');
    expect(await screen.findByText('Nenhuma conversa ainda')).toBeInTheDocument();
    await router.navigate('/perfil');
    expect(await screen.findByText('bia@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();
    // Nenhum dado privado de Alex permanece no cache.
    await waitFor(() => expect(cachedUserIds(queryClient)).not.toContain(alexIds[0]));

    await signOutFromProfile(user, router);
    await signIn(user, DEMO_EMAIL, 'demo1234');
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    await router.navigate('/progresso');
    expect(await screen.findByText('Aulas concluídas')).toBeInTheDocument();
    expect(screen.queryByText('Nada por aqui ainda')).not.toBeInTheDocument();
  });
});

describe('Exclusão de conta', () => {
  it('TESTE 7 — excluir → visitante na página inicial; Voltar não revela dados', async () => {
    const api = await createReadyAccount();
    const { user, router, queryClient } = renderApp(['/perfil', '/privacidade'], api);
    await user.click(await screen.findByRole('button', { name: /Excluir minha conta/ }));
    const dialog = openDialog();
    await user.type(within(dialog).getByLabelText('Senha'), 'segura123');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente', hidden: true }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Sua conta e seus dados foram excluídos.')).toBeInTheDocument();
    await waitFor(() => expect(cachedUserIds(queryClient)).toEqual([]));

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.queryByText('bia@example.com')).not.toBeInTheDocument();
    expect(await api.getSession()).toBeNull();
  });

  it('senha errada não exclui e mantém a pessoa conectada', async () => {
    const api = await createReadyAccount();
    const { user, router } = renderApp('/privacidade', api);
    await user.click(await screen.findByRole('button', { name: /Excluir minha conta/ }));
    const dialog = openDialog();
    await user.type(within(dialog).getByLabelText('Senha'), 'errada123');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente', hidden: true }));
    expect(await within(dialog).findByText('Senha incorreta.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/privacidade');
    expect(await api.getSession()).not.toBeNull();
  });
});

describe('"Sair" nas etapas do primeiro acesso', () => {
  it('TESTE 8 — configuração inicial: "Sair da conta" realmente sai e a etapa é retomada depois', async () => {
    const { user, router } = renderApp('/cadastro');
    await signUp(user, 'Caio', 'caio@example.com');
    await screen.findByRole('heading', { name: /principal objetivo/ });

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    const dialog = openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Sair da conta', hidden: true }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));

    await signIn(user, 'caio@example.com');
    await waitFor(() => expect(router.state.location.pathname).toBe('/configuracao'));
  });

  it('TESTE 9 — nivelamento: "Sair da conta" realmente sai; "Continuar aqui" mantém a pessoa na etapa', async () => {
    const { user, router } = renderApp('/cadastro');
    await signUp(user, 'Duda', 'duda@example.com');
    await screen.findByRole('heading', { name: /principal objetivo/ });
    await user.click(screen.getByText('Conversar', { selector: 'span' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByText('Básico', { selector: 'span' }));
    await user.click(screen.getByRole('button', { name: 'Estudei na escola' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: /Salvar e fazer o nivelamento/ }));
    await user.click(await screen.findByRole('button', { name: 'Começar nivelamento' }));
    await screen.findByText(/Atividade 1 de/);

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    let dialog = openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Continuar aqui', hidden: true }));
    expect(router.state.location.pathname).toBe('/nivelamento');

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    dialog = openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Sair da conta', hidden: true }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));

    await signIn(user, 'duda@example.com');
    await waitFor(() => expect(router.state.location.pathname).toBe('/nivelamento'));
  });
});

describe('Jornadas e recarregamento', () => {
  it('TESTE 10 — cadastro completo: conta → configuração → nivelamento → início', async () => {
    const { user, router } = renderApp('/cadastro');
    await signUp(user, 'Eva', 'eva@example.com');
    await finishFirstAccess(user, router);
    expect(await screen.findByRole('heading', { level: 1, name: /Eva/ })).toBeInTheDocument();
  });

  it('TESTE 13 — recarregar uma rota protegida com sessão mantém a conta', async () => {
    const storage = new MemoryStorage();
    const first = createTestApi(storage);
    await first.startDemo!();
    renderApp('/progresso', first);
    await screen.findByText('Aulas concluídas');
    cleanup();

    // "Recarregar": novo app (novo cache e cliente) sobre o mesmo armazenamento.
    const { router } = renderApp('/progresso', createTestApi(storage));
    expect(await screen.findByText('Aulas concluídas')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/progresso');
  });

  it('TESTE 14 — recarregar sem sessão leva ao login e volta à rota depois de entrar', async () => {
    const api = await createReadyAccount();
    await api.logout();
    const { user, router } = renderApp('/vocabulario', api);
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    await signIn(user, 'bia@example.com');
    await waitFor(() => expect(router.state.location.pathname).toBe('/vocabulario'));
  });
});

describe('Preferências salvas automaticamente', () => {
  it('cliques rápidos: a última escolha prevalece mesmo se a primeira resposta demorar mais', async () => {
    const api = await createReadyAccount();
    let call = 0;
    const slowFirst: ApiClient = new Proxy(api, {
      get(target, property, receiver) {
        if (property === 'updatePreferences') {
          return async (input: Parameters<ApiClient['updatePreferences']>[0]) => {
            const delay = call++ === 0 ? 300 : 10;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return target.updatePreferences(input);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { user } = renderApp('/preferencias', slowFirst);
    await screen.findByRole('heading', { level: 1, name: 'Preferências' });
    await user.click(screen.getByRole('radio', { name: /Leve/ }));
    await user.click(screen.getByRole('radio', { name: /Detalhada/ }));
    // A interface mostra a última escolha na hora…
    expect(screen.getByRole('radio', { name: /Detalhada/ })).toBeChecked();
    // …e ela continua depois que todas as respostas chegam (inclusive a lenta, da primeira).
    await waitFor(async () => expect((await api.getPreferences()).correctionIntensity).toBe('detailed'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.getByRole('radio', { name: /Detalhada/ })).toBeChecked();
  });
});
