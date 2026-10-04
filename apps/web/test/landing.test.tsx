import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '@english-ai/core';
import type { ApiClient } from '../src/services';
import { createReadyAccount, createTestApi, renderApp } from './renderApp';

const SECTION_LINKS = [
  ['Início', '#inicio'],
  ['Como funciona', '#como-funciona'],
  ['Aprender', '#aprender'],
  ['Conversar', '#conversar'],
  ['IA', '#ia'],
  ['Progresso', '#progresso'],
  ['Segurança', '#seguranca'],
] as const;

/** Mesmo cliente, mas como no modo http: sem conta de demonstração. */
function httpLike(api: ApiClient = createTestApi()): ApiClient {
  return new Proxy(api, {
    get(target, property, receiver) {
      if (property === 'mode') return 'http';
      if (property === 'startDemo') return undefined;
      return Reflect.get(target, property, receiver);
    },
  });
}

describe('Página pública (/)', () => {
  it('renderiza o hero, o cabeçalho com as seções e as ações de conta', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Aprenda inglês no seu ritmo, com uma IA que realmente explica/ })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Seções da página' });
    for (const [label, href] of SECTION_LINKS) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(within(header).getAllByRole('link', { name: 'Criar conta' })[0]).toHaveAttribute('href', '/cadastro');
  });

  it('tem todas as seções pedidas, cada uma com título', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    for (const id of ['inicio', 'problema', 'como-funciona', 'aprender', 'conversar', 'ia', 'progresso', 'personalizacao', 'seguranca', 'sobre']) {
      const section = document.getElementById(id);
      expect(section, id).not.toBeNull();
      expect(section?.querySelector('h1, h2'), id).not.toBeNull();
    }
    expect(screen.getByRole('heading', { name: /Seu próximo passo no inglês/ })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('CTAs levam ao cadastro e ao login', async () => {
    const { user, router } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Começar gratuitamente' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cadastro'));
    await router.navigate('/');
    await user.click(await screen.findByRole('link', { name: 'Já tenho conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('modo demonstração: um único "Explorar demonstração…" no topo, e ele entra na conta de exemplo', async () => {
    const { user, router } = renderApp('/');
    const demo = await screen.findAllByRole('button', { name: /Explorar demonstração/ });
    expect(demo).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Testar a demonstração' })).toBeInTheDocument();
    await user.click(demo[0] as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
  });

  it('modo http: nenhuma ação de demonstração aparece', async () => {
    renderApp('/', httpLike());
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /demonstração/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Modo demonstração/)).not.toBeInTheDocument();
  });

  it('links de seção atualizam a âncora e levam o foco ao título da seção', async () => {
    const { user, router } = renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Seções da página' });
    await user.click(within(nav).getByRole('link', { name: 'Aprender' }));
    expect(router.state.location.hash).toBe('#aprender');
    expect(document.activeElement).toBe(document.getElementById('aprender-title'));

    await user.click(within(screen.getByRole('navigation', { name: 'Rodapé' })).getByRole('link', { name: 'Sobre o projeto' }));
    expect(router.state.location.hash).toBe('#sobre');
    expect(document.activeElement).toBe(document.getElementById('sobre-title'));
    // Âncora não cria entrada nova no histórico nem troca de rota.
    expect(router.state.location.pathname).toBe('/');
  });

  it('chegando com âncora no endereço, o foco vai para a seção', async () => {
    renderApp('/#seguranca');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('seguranca-title')));
  });

  it('menu de seções (telas menores): abre, fecha com Esc e devolve o foco ao botão', async () => {
    const { user } = renderApp('/');
    const toggle = await screen.findByRole('button', { name: 'Menu de seções' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'landing-sections');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    await user.click(within(screen.getByRole('navigation', { name: 'Seções da página' })).getByRole('link', { name: 'IA' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('rodapé: conta, recuperação de senha e termos', async () => {
    renderApp('/');
    const footer = await screen.findByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Recuperar senha' })).toHaveAttribute('href', '/recuperar-senha');
    expect(within(footer).getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos-e-privacidade');
    expect(within(footer).getByText('English AI · Projeto acadêmico — MVP em desenvolvimento.')).toBeInTheDocument();
  });
});

describe('Página pública — honestidade do conteúdo', () => {
  it('os números vêm do conteúdo real do produto', async () => {
    renderApp('/');
    const facts = await screen.findByRole('list', { name: 'O que já está disponível' });
    expect(within(facts).getByText(String(LESSONS.length))).toBeInTheDocument();
  });

  it('sem depoimentos, métricas de usuários ou promessas inventadas', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/depoimento|parceir[ao]s? oficia|certificad[ao] por|n[ºo°]\s?1|número 1/i);
    expect(text).not.toMatch(/\d[\d.,]*\s*(mil|k)?\s*(alunos|usuários|estudantes|pessoas)/i);
    expect(text).not.toMatch(/mais rápido que|garantid[ao]|fluente em \d/i);

    // Porcentagens só aparecem dentro da prévia marcada como exemplo ilustrativo.
    const example = screen.getByRole('group', { name: 'Exemplo ilustrativo da tela de Progresso' });
    const outside = text.replace(example.textContent ?? '', '');
    expect(outside).not.toMatch(/\d\s*%/);
    expect(within(example).getByText('Exemplo ilustrativo')).toBeInTheDocument();
  });

  it('as correções de exemplo vêm do verificador gramatical do projeto', async () => {
    renderApp('/');
    const ai = (await screen.findAllByRole('group', { name: 'Exemplo de correção explicada' }))[0] as HTMLElement;
    expect(within(ai).getAllByText(/I am 25 years old/).length).toBeGreaterThan(0);
    expect(within(ai).getByText(/a idade é dita com o verbo "to be"/)).toBeInTheDocument();
  });
});

describe('Página pública com sessão ativa', () => {
  it('conta pronta: "/" leva ao Início, sem mostrar a página pública', async () => {
    const api = await createReadyAccount();
    const { router } = renderApp('/', api);
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'));
    expect(screen.queryByRole('navigation', { name: 'Seções da página' })).not.toBeInTheDocument();
  });

  it('conta nova: "/" leva à etapa pendente (configuração inicial)', async () => {
    const api = createTestApi();
    await api.register({ name: 'Rui', email: 'rui@example.com', password: 'segura123', passwordConfirmation: 'segura123', acceptedTerms: true });
    const { router } = renderApp('/', api);
    await waitFor(() => expect(router.state.location.pathname).toBe('/configuracao'));
  });
});
