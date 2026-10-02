/**
 * Correção determinística de exercícios (RF10). O gabarito decide se a resposta está certa;
 * a IA apenas complementa a explicação — isso evita que respostas incorretas do modelo
 * contaminem a avaliação (Análise de requisitos, Risco 2).
 */
import type { Exercise } from './content';
import { countWords, editDistance, normalizeAnswer } from './text';

export type GradeStatus = 'correct' | 'almost' | 'incorrect';

export interface GradeResult {
  status: GradeStatus;
  /** Forma recomendada (primeira resposta aceita). */
  expected: string | null;
}

const TYPED_EXERCISES = new Set(['fill_blank', 'translate']);

export function gradeClosedExercise(exercise: Exercise, answer: string): GradeResult {
  const expected = exercise.acceptedAnswers[0] ?? null;
  const normalized = normalizeAnswer(answer);
  if (!normalized) return { status: 'incorrect', expected };
  const accepted = exercise.acceptedAnswers.map(normalizeAnswer);
  if (accepted.includes(normalized)) return { status: 'correct', expected };

  if (TYPED_EXERCISES.has(exercise.type)) {
    const closest = Math.min(...accepted.map((candidate) => editDistance(candidate, normalized)));
    const tolerance = Math.max(1, Math.floor(normalized.length / 12));
    if (normalized.length >= 3 && closest <= tolerance) return { status: 'almost', expected };
  }
  return { status: 'incorrect', expected };
}

export interface RequirementCheck {
  ok: boolean;
  message: string | null;
}

/** Requisitos mínimos de exercícios abertos ("write"). */
export function checkWriteRequirements(exercise: Exercise, answer: string): RequirementCheck {
  const text = answer.replace(/[‘’]/g, "'");
  const minWords = exercise.minWords ?? 3;
  if (countWords(text) < minWords) {
    return { ok: false, message: `Escreva uma frase completa, com pelo menos ${minWords} palavras.` };
  }
  for (const requirement of exercise.requirements ?? []) {
    if (!new RegExp(requirement.pattern, 'i').test(text)) return { ok: false, message: requirement.message };
  }
  return { ok: true, message: null };
}

const CORRECT_TITLES = ['Muito bem!', 'Isso mesmo!', 'Perfeito!', 'Excelente!'];

export function feedbackTitle(status: GradeStatus, seed: number): string {
  if (status === 'almost') return 'Quase lá!';
  if (status === 'incorrect') return 'Vamos ajustar';
  return CORRECT_TITLES[seed % CORRECT_TITLES.length] ?? 'Muito bem!';
}
