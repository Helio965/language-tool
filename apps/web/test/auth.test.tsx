import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createReadyAccount, createTestApi, renderApp } from './renderApp';

describe('Cadastro (UC01)', () => {
  it('valida os campos ao enviar e leva o foco ao primeiro erro', async () => {
    const { user } = renderApp('/cadastro');
    await user.click(await screen.findByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument();
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Confirme sua senha.')).toBeInTheDocument();
    expect(screen.getByText(/aceite os termos/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });

  it('cria a conta e segue para a configuração inicial', async () => {
    const { user, router } = renderApp('/cadastro');
    await user.type(await screen.findByLabelText('Nome'), 'Bia');
    await user.type(screen.getByLabelText('E-mail'), 'bia@example.com');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.type(screen.getByLabelText('Confirme a senha'), 'segura123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { name: /principal objetivo/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/configuracao');
  });

  it('avisa quando o e-mail já tem conta e oferece entrar', async () => {
    const api = await createReadyAccount();
    await api.logout();
    const { user } = renderApp('/cadastro', api);
    await user.type(await screen.findByLabelText('Nome'), 'Bia');
    await user.type(screen.getByLabelText('E-mail'), 'bia@example.com');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.type(screen.getByLabelText('Confirme a senha'), 'segura123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/Já existe uma conta com este e-mail/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar com este e-mail' })).toBeInTheDocument();
  });
});

describe('Login (UC02) e proteção de rotas', () => {
  it('mostra mensagem genérica para credenciais erradas e limpa a senha', async () => {
    const api = await createReadyAccount();
    await api.logout();
    const { user } = renderApp('/entrar', api);
    await user.type(await screen.findByLabelText('E-mail'), 'bia@example.com');
    await user.type(screen.getByLabelText('Senha'), 'errada123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail ou senha incorretos. Tente novamente.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });

  it('redireciona para o login ao acessar uma área protegida sem sessão', async () => {
    const { router } = renderApp('/progresso', createTestApi());
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('após entrar, volta para a página que a pessoa tentou abrir', async () => {
    const api = await createReadyAccount();
    await api.logout();
    const { user, router } = renderApp('/progresso', api);
    await user.type(await screen.findByLabelText('E-mail'), 'bia@example.com');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/progresso'));
  });
});
