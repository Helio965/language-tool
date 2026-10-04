import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@english-ai/core';
import { ApiError, type ApiClient } from '../src/services';
import { createTestApi, renderApp } from './renderApp';

const EMAIL = 'bia@example.com';
const OLD = 'segura123';
const NEW = 'novaSenha9';
const RESETS_KEY = 'english-ai:v1:passwordResets';

async function registerBia(api: ApiClient) {
  await api.register({ name: 'Bia', email: EMAIL, password: OLD, passwordConfirmation: OLD, acceptedTerms: true });
  await api.logout();
}

/** Pede a redefinição e devolve o caminho do link simulado (modo demonstração). */
async function requestLink(api: ApiClient): Promise<string> {
  const result = await api.requestPasswordReset(EMAIL);
  if (!result.simulatedEmail) throw new Error('esperava o e-mail simulado');
  return result.simulatedEmail.resetPath;
}

async function fillNewPassword(user: ReturnType<typeof renderApp>['user'], password = NEW, confirmation = password) {
  await user.type(await screen.findByLabelText('Nova senha'), password);
  await user.type(screen.getByLabelText('Confirme a nova senha'), confirmation);
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
}

describe('Esqueci minha senha', () => {
  it('modo demonstração: mensagem genérica + e-mail simulado identificado, com o link que leva à nova senha', async () => {
    const api = createTestApi();
    await registerBia(api);
    const { user, router } = renderApp('/entrar', api);

    await user.click(await screen.findByRole('link', { name: 'Esqueci minha senha' }));
    await user.type(await screen.findByLabelText('E-mail'), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));

    expect(await screen.findByText('Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.')).toBeInTheDocument();
    const simulation = screen.getByRole('region', { name: /Simulação do modo demonstração/ });
    expect(within(simulation).getByText('Nenhum e-mail real é enviado na demonstração.')).toBeInTheDocument();
    expect(within(simulation).getByText(EMAIL)).toBeInTheDocument();

    await user.click(within(simulation).getByRole('link', { name: 'Abrir o link de redefinição' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/redefinir-senha\/[A-Za-z0-9_-]{43}$/));
    await fillNewPassword(user);
    expect(await screen.findByRole('heading', { name: 'Senha redefinida com sucesso.' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Entrar' }));
    await user.type(await screen.findByLabelText('E-mail'), EMAIL);
    await user.type(screen.getByLabelText('Senha', { selector: 'input' }), OLD);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos. Tente novamente.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Senha', { selector: 'input' }), NEW);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/configuracao'));
  });

  it('e-mail sem conta: a mesma mensagem; a simulação diz que nenhum e-mail seria enviado', async () => {
    const { user } = renderApp('/recuperar-senha');
    await user.type(await screen.findByLabelText('E-mail'), 'ninguem@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));
    expect(await screen.findByText('Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.')).toBeInTheDocument();
    expect(screen.getByText('Não há conta com este e-mail neste navegador, então nenhum e-mail seria enviado.')).toBeInTheDocument();
  });

  it('modo http: orienta a conferir a caixa de entrada e não mostra simulação', async () => {
    const base = createTestApi();
    const http: ApiClient = new Proxy(base, {
      get(target, property, receiver) {
        if (property === 'mode') return 'http';
        if (property === 'requestPasswordReset') {
          return async () => ({ message: 'Se existir uma conta com este e-mail, enviaremos as instruções de recuperação.', expiresInMinutes: 15 });
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { user } = renderApp('/recuperar-senha', http);
    await user.type(await screen.findByLabelText('E-mail'), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));
    expect(await screen.findByText(/Confira a caixa de entrada e a pasta de spam. O link vale por 15 minutos/)).toBeInTheDocument();
    expect(screen.queryByText(/Simulação/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhum e-mail é enviado de fato/i)).not.toBeInTheDocument();
  });

  it('valida o e-mail antes de enviar', async () => {
    const { user } = renderApp('/recuperar-senha');
    await user.type(await screen.findByLabelText('E-mail'), 'sem-arroba');
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));
    expect(await screen.findByText('Digite um e-mail válido, como nome@exemplo.com.')).toBeInTheDocument();
  });
});

describe('Redefinir senha — estados do link', () => {
  it('link inválido: explica e oferece pedir um novo', async () => {
    const { user, router } = renderApp(`/redefinir-senha/${'x'.repeat(43)}`);
    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Pedir um novo link' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/recuperar-senha'));
  });

  it('link vencido', async () => {
    const storage = new MemoryStorage();
    const api = createTestApi(storage);
    await registerBia(api);
    const path = await requestLink(api);
    const rows = JSON.parse(storage.getItem(RESETS_KEY) ?? '[]') as Array<{ expiresAt: string }>;
    storage.setItem(RESETS_KEY, JSON.stringify(rows.map((row) => ({ ...row, expiresAt: '2000-01-01T00:00:00.000Z' }))));
    renderApp(path, api);
    expect(await screen.findByRole('heading', { name: 'Este link venceu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeInTheDocument();
  });

  it('link já usado: não redefine de novo', async () => {
    const api = createTestApi();
    await registerBia(api);
    const path = await requestLink(api);
    const first = renderApp(path, api);
    await fillNewPassword(first.user);
    await screen.findByRole('heading', { name: 'Senha redefinida com sucesso.' });
    first.view.unmount();

    renderApp(path, api);
    expect(await screen.findByRole('heading', { name: 'Este link já foi usado' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('aplica a política de senha do cadastro e mantém o link válido', async () => {
    const api = createTestApi();
    await registerBia(api);
    const path = await requestLink(api);
    const { user } = renderApp(path, api);
    await fillNewPassword(user, 'curta1');
    expect(await screen.findByText('A senha precisa ter 8+ caracteres, com letras e números.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Requisitos da senha' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Nova senha'));
    await user.clear(screen.getByLabelText('Confirme a nova senha'));
    await fillNewPassword(user, NEW, 'outraSenha1');
    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(await api.checkPasswordResetToken(path.split('/').pop() ?? '')).toBe('valid');
  });

  it('falha de rede ao verificar: mensagem e "Tentar de novo" que funciona', async () => {
    const base = createTestApi();
    await registerBia(base);
    const path = await requestLink(base);
    let fail = true;
    const flaky: ApiClient = new Proxy(base, {
      get(target, property, receiver) {
        if (property === 'checkPasswordResetToken') {
          return async (token: string) => {
            if (fail) throw new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
            return target.checkPasswordResetToken(token);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { user } = renderApp(path, flaky);
    expect(await screen.findByRole('heading', { name: 'Não foi possível verificar o link' })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Nova senha')).toBeInTheDocument();
  });
});

describe('Redefinir senha — sessão aberta neste navegador', () => {
  it('se a conta estava conectada aqui, a sessão é encerrada e as telas privadas pedem login', async () => {
    const api = createTestApi();
    await api.register({ name: 'Bia', email: EMAIL, password: OLD, passwordConfirmation: OLD, acceptedTerms: true });
    const path = await requestLink(api);
    const { user, router } = renderApp(path, api);
    await fillNewPassword(user);
    expect(await screen.findByRole('heading', { name: 'Senha redefinida com sucesso.' })).toBeInTheDocument();
    expect(await screen.findByText('Você saiu da sua conta.')).toBeInTheDocument();
    expect(await api.getSession()).toBeNull();

    await router.navigate('/configuracao');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });
});
