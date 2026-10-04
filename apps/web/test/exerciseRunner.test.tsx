import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExerciseFeedback, PublicExercise } from '@english-ai/core';
import { ExerciseRunner } from '../src/features/exercises/ExerciseRunner';

const exercises: PublicExercise[] = [
  {
    id: 'ex-1',
    lessonId: 'simple-present',
    type: 'multiple_choice',
    instruction: 'Escolha a forma correta.',
    prompt: 'She ___ to school every day.',
    options: ['go', 'goes', 'going'],
    skillTag: 'simple_present',
  },
  {
    id: 'ex-2',
    lessonId: 'simple-present',
    type: 'fill_blank',
    instruction: 'Complete a frase.',
    prompt: 'He ___ coffee.',
    skillTag: 'simple_present',
  },
];

function feedback(overrides: Partial<ExerciseFeedback>): ExerciseFeedback {
  return {
    exerciseId: 'ex-1',
    status: 'incorrect',
    title: 'Quase lá!',
    userAnswer: 'go',
    expectedAnswer: 'goes',
    explanation: 'Com he, she e it, o verbo ganha -s no presente.',
    supportExplanation: null,
    tip: null,
    correction: null,
    aiFeedback: null,
    ...overrides,
  };
}

describe('ExerciseRunner (UC06)', () => {
  it('só verifica depois de responder e explica o erro antes de continuar', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockResolvedValueOnce(feedback({})).mockResolvedValueOnce(
      feedback({ exerciseId: 'ex-2', status: 'correct', title: 'Isso mesmo!', userAnswer: 'drinks', expectedAnswer: 'drinks' }),
    );
    const onFinish = vi.fn();
    render(<ExerciseRunner exercises={exercises} onAnswer={onAnswer} onFinish={onFinish} />);

    expect(screen.getByText('Exercício 1 de 2')).toBeInTheDocument();
    const verify = screen.getByRole('button', { name: 'Verificar' });
    expect(verify).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'go' }));
    await user.click(verify);

    expect(onAnswer).toHaveBeenCalledWith(exercises[0], 'go');
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Quase lá!');
    expect(status).toHaveTextContent('Sua resposta');
    expect(status).toHaveTextContent('Forma recomendada');
    expect(status).toHaveTextContent('o verbo ganha -s');

    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Exercício 2 de 2')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Complete a lacuna' }), 'drinks');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Isso mesmo!');

    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onFinish).toHaveBeenCalledWith([
      { exerciseId: 'ex-1', correct: false },
      { exerciseId: 'ex-2', correct: true },
    ]);
  });

  it('mostra o erro e permite tentar de novo se a verificação falhar', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(feedback({ status: 'correct', title: 'Isso mesmo!' }));
    render(<ExerciseRunner exercises={exercises} onAnswer={onAnswer} onFinish={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: 'goes' }));
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Isso mesmo!');
  });
});
