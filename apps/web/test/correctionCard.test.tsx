import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Correction } from '@english-ai/core';
import { CorrectionCard } from '../src/components/CorrectionCard';

const correction: Correction = {
  original: 'I have 25 years.',
  suggestion: 'I am 25 years old.',
  changes: [{ from: 'have 25 years', to: 'am 25 years old' }],
  explanation: 'Em inglês, a idade é dita com o verbo "to be".',
  tip: 'Pense em "eu sou 25 anos de idade".',
  severity: 'grammar',
  skillTag: 'to_be',
  ruleId: 'age_with_have',
};

describe('CorrectionCard (UC07)', () => {
  it('mostra Sua frase → Forma recomendada → Explicação, destacando o que mudou', () => {
    render(<CorrectionCard correction={correction} />);
    expect(screen.getByText('Sua frase')).toBeInTheDocument();
    expect(screen.getByText(/Forma recomendada/)).toBeInTheDocument();
    expect(screen.getByText('Explicação')).toBeInTheDocument();
    expect(screen.getByText('am 25 years old', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('have 25 years', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText(/verbo "to be"/)).toBeInTheDocument();
    expect(screen.getByText(/Gramática/)).toBeInTheDocument();
  });

  it('na conversa é discreta: a explicação só abre quando a pessoa pede', async () => {
    const user = userEvent.setup();
    render(<CorrectionCard correction={correction} variant="chat" />);
    const why = screen.getByRole('button', { name: /Por quê/ });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/verbo "to be"/)).not.toBeVisible();

    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/verbo "to be"/)).toBeVisible();
  });
});
