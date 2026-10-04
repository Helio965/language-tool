/**
 * UC04 — Realizar nivelamento. Resultado salvo no perfil como NÍVEL ESTIMADO.
 */
import { PLACEMENT_PASS_THRESHOLD, PLACEMENT_STAGES } from '../../content/placement';
import { AppError } from '../../domain/errors';
import { LEVEL_DESCRIPTIONS, LEVEL_LABELS, levelIndex, type Level } from '../../domain/levels';
import { evaluatePlacement, isPlacementAnswerCorrect } from '../../domain/placement';
import type { PerceivedLevel } from '../../domain/profile';
import { loadProfile, requireUser, type ServiceContext } from '../context';
import type { PlacementResultView, PlacementStepView } from '../views';

function comparison(perceived: PerceivedLevel, estimated: Level): string {
  if (perceived === 'unknown') return 'Agora você tem um ponto de partida. Ele será ajustado conforme você estuda.';
  const diff = levelIndex(estimated) - levelIndex(perceived);
  if (diff === 0) return 'Sua percepção combinou com a estimativa. Ótimo autoconhecimento!';
  if (diff > 0) return 'Você sabe mais do que imaginava! Vamos aproveitar isso.';
  return 'Vamos começar um pouco antes para consolidar a base — você avança rápido quando estiver confortável.';
}

export function createPlacementService(ctx: ServiceContext) {
  const questions = () => ctx.catalog.placementQuestions();

  function resultView(level: Level, perceived: PerceivedLevel, data: Omit<PlacementResultView, 'level' | 'levelLabel' | 'levelDescription' | 'perceivedLevel' | 'comparison'>): PlacementResultView {
    return {
      level,
      levelLabel: LEVEL_LABELS[level],
      levelDescription: LEVEL_DESCRIPTIONS[level],
      perceivedLevel: perceived,
      comparison: data.skipped ? 'Você pode refazer o nivelamento quando quiser, no seu perfil.' : comparison(perceived, level),
      ...data,
    };
  }

  return {
    async start(userId: string): Promise<PlacementStepView> {
      await requireUser(ctx, userId);
      const step = evaluatePlacement(questions(), PLACEMENT_STAGES, PLACEMENT_PASS_THRESHOLD, {});
      if (step.status !== 'continue') throw new AppError('INTERNAL', 'Nivelamento sem atividades.');
      return { status: 'continue', stageNumber: step.stageNumber, totalStages: step.totalStages, questions: step.questions };
    },

    /** Recebe todas as respostas dadas até agora; devolve a próxima etapa ou o resultado. */
    async submit(userId: string, answers: Record<string, string>): Promise<PlacementStepView> {
      await requireUser(ctx, userId);
      const known = new Map(questions().map((question) => [question.id, question]));
      const clean: Record<string, string> = {};
      for (const [id, answer] of Object.entries(answers ?? {})) {
        if (known.has(id) && typeof answer === 'string') clean[id] = answer.slice(0, 200);
      }
      const step = evaluatePlacement(questions(), PLACEMENT_STAGES, PLACEMENT_PASS_THRESHOLD, clean);
      if (step.status === 'continue') {
        return { status: 'continue', stageNumber: step.stageNumber, totalStages: step.totalStages, questions: step.questions };
      }

      const now = ctx.now().toISOString();
      for (const [id, answer] of Object.entries(clean)) {
        const question = known.get(id);
        if (!question) continue;
        await ctx.store.attempts.add({
          id: ctx.id(),
          userId,
          exerciseId: `placement:${id}`,
          lessonId: null,
          skillTag: question.skillTag,
          context: 'placement',
          answer,
          isCorrect: isPlacementAnswerCorrect(question, answer),
          createdAt: now,
        });
      }
      const { evaluation } = step;
      const profile = await loadProfile(ctx, userId);
      await ctx.store.profiles.save({
        ...profile,
        estimatedLevel: evaluation.level,
        placementScore: evaluation.score,
        placementCompletedAt: now,
        updatedAt: now,
      });
      return {
        status: 'done',
        result: resultView(evaluation.level, profile.perceivedLevel, {
          score: evaluation.score,
          correct: evaluation.correct,
          answered: evaluation.answered,
          stages: evaluation.stages,
          skipped: false,
        }),
      };
    },

    /** "Prefiro começar do zero": nível Iniciante sem avaliação. */
    async skip(userId: string): Promise<PlacementResultView> {
      await requireUser(ctx, userId);
      const profile = await loadProfile(ctx, userId);
      const now = ctx.now().toISOString();
      await ctx.store.profiles.save({ ...profile, estimatedLevel: 'beginner', placementScore: null, placementCompletedAt: now, updatedAt: now });
      return resultView('beginner', profile.perceivedLevel, { score: 0, correct: 0, answered: 0, stages: [], skipped: true });
    },
  };
}

export type PlacementService = ReturnType<typeof createPlacementService>;
