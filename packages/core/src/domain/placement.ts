/**
 * Nivelamento adaptativo simples (RF05, UC04). Cada etapa verifica o conteúdo de um nível;
 * a próxima etapa só é apresentada quando o usuário vai bem na atual.
 * O resultado é uma ESTIMATIVA pedagógica — não uma certificação.
 */
import type { PlacementQuestion, PublicPlacementQuestion } from './content';
import { LEVELS, type Level } from './levels';
import { normalizeAnswer } from './text';

export interface PlacementStageResult {
  stage: Level;
  correct: number;
  total: number;
  passed: boolean;
}

export interface PlacementEvaluation {
  level: Level;
  /** Percentual de acertos sobre as questões respondidas. */
  score: number;
  correct: number;
  answered: number;
  stages: PlacementStageResult[];
}

export type PlacementStep =
  | {
      status: 'continue';
      stage: Level;
      stageNumber: number;
      totalStages: number;
      questions: PublicPlacementQuestion[];
    }
  | { status: 'done'; evaluation: PlacementEvaluation };

function toPublic(question: PlacementQuestion): PublicPlacementQuestion {
  const { answer: _answer, ...rest } = question;
  return rest;
}

export function isPlacementAnswerCorrect(question: PlacementQuestion, answer: string | undefined): boolean {
  return answer !== undefined && normalizeAnswer(answer) === normalizeAnswer(question.answer);
}

export function evaluatePlacement(
  questions: readonly PlacementQuestion[],
  stages: readonly Level[],
  passThreshold: number,
  answers: Record<string, string>,
): PlacementStep {
  const results: PlacementStageResult[] = [];
  for (const [index, stage] of stages.entries()) {
    const stageQuestions = questions.filter((question) => question.stage === stage);
    const unanswered = stageQuestions.some((question) => answers[question.id] === undefined);
    if (unanswered) {
      return {
        status: 'continue',
        stage,
        stageNumber: index + 1,
        totalStages: stages.length,
        questions: stageQuestions.map(toPublic),
      };
    }
    const correct = stageQuestions.filter((question) => isPlacementAnswerCorrect(question, answers[question.id])).length;
    const passed = correct >= passThreshold;
    results.push({ stage, correct, total: stageQuestions.length, passed });
    if (!passed) break;
  }

  const passedStages = results.filter((result) => result.passed).length;
  const level = LEVELS[Math.min(passedStages, LEVELS.length - 1)] ?? 'beginner';
  const correct = results.reduce((sum, result) => sum + result.correct, 0);
  const answered = results.reduce((sum, result) => sum + result.total, 0);
  return {
    status: 'done',
    evaluation: { level, score: answered ? Math.round((correct / answered) * 100) : 0, correct, answered, stages: results },
  };
}
