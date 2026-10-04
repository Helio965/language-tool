import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createReadyAccount, renderApp } from './renderApp';

describe('Modo Conversação (UC09)', () => {
  it('responde, corrige de forma discreta e reúne os pontos no feedback final', async () => {
    const api = await createReadyAccount();
    const conversation = await api.startConversation('introductions');
    const { user } = renderApp(`/conversar/${conversation.id}`, api);

    const log = await screen.findByRole('log');
    expect(within(log).getByText(/Bia/)).toBeInTheDocument();
    expect(screen.getByText(/é uma IA e pode errar/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Sua mensagem em inglês'), 'I have 25 years.');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    // A IA continua a conversa e a correção aparece sem interromper.
    expect(await within(log).findByText('More natural')).toBeInTheDocument();
    expect(within(log).getByText(/you are 25 years old/)).toBeInTheDocument();
    expect(within(log).getByRole('button', { name: /Por quê/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Sua mensagem em inglês')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Encerrar' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    await user.click(within(dialog).getByRole('button', { name: 'Encerrar e ver feedback', hidden: true }));

    expect(await screen.findByRole('heading', { name: /Veja o que praticar/ })).toBeInTheDocument();
    expect(screen.getByText('Pontos para praticar')).toBeInTheDocument();
    expect(screen.getAllByText('Sua frase').length).toBeGreaterThan(0);
  });

  it('lista assuntos com no máximo 3 recomendações', async () => {
    const api = await createReadyAccount();
    renderApp('/conversar', api);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    const recommended = await screen.findAllByText('Para você');
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.length).toBeLessThanOrEqual(3);
  });
});
