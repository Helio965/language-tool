/**
 * UC04 (Nivelamento), UC05–UC07 (Aula, exercício e correção), UC08 (Revisão), UC10 (Vocabulário),
 * UC11 (Progresso) e Página inicial.
 */
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AppServices } from '@english-ai/core';
import { requireAuth, userIdOf } from '../middleware/security';

const id = z.string().min(1).max(80);
const answerSchema = z.object({ answer: z.string().max(1000) });
const attemptSchema = z.object({ attempt: z.number().int().min(0).max(1000).default(0) });
const completeSchema = z.object({ timeSpentSeconds: z.number().min(0).max(24 * 3600).default(0) });
const placementSchema = z.object({ answers: z.record(z.string().max(20), z.string().max(200)) });
const reviewAnswerSchema = z.object({ exerciseId: id, answer: z.string().max(1000) });
const reviewCompleteSchema = z.object({
  correct: z.number().int().min(0).max(100),
  total: z.number().int().min(0).max(100),
  timeSpentSeconds: z.number().min(0).max(3600).default(0),
});
const vocabularyStatusSchema = z.object({ status: z.enum(['learning', 'learned']) });

export function learningRoutes(deps: { services: AppServices; aiLimiter: RequestHandler }): Router {
  const { services, aiLimiter } = deps;
  const router = Router();
  router.use(['/home', '/progress', '/placement', '/lessons', '/vocabulary', '/reviews'], requireAuth);

  router.get('/home', async (_req, res) => {
    res.json(await services.progress.home(userIdOf(res)));
  });
  router.get('/progress', async (_req, res) => {
    res.json(await services.progress.overview(userIdOf(res)));
  });

  // Nivelamento
  router.post('/placement/start', async (_req, res) => {
    res.json(await services.placement.start(userIdOf(res)));
  });
  router.post('/placement/answers', async (req, res) => {
    res.json(await services.placement.submit(userIdOf(res), placementSchema.parse(req.body).answers));
  });
  router.post('/placement/skip', async (_req, res) => {
    res.json(await services.placement.skip(userIdOf(res)));
  });

  // Modo Aprender
  router.get('/lessons', async (_req, res) => {
    res.json(await services.learning.listLessons(userIdOf(res)));
  });
  router.get('/lessons/:lessonId', async (req, res) => {
    res.json(await services.learning.getLesson(userIdOf(res), id.parse(req.params.lessonId)));
  });
  router.post('/lessons/:lessonId/start', async (req, res) => {
    await services.learning.startLesson(userIdOf(res), id.parse(req.params.lessonId));
    res.status(204).end();
  });
  router.post('/lessons/:lessonId/exercises/:exerciseId/answer', aiLimiter, async (req, res) => {
    const { answer } = answerSchema.parse(req.body);
    res.json(
      await services.learning.checkAnswer(userIdOf(res), id.parse(req.params.lessonId), id.parse(req.params.exerciseId), answer),
    );
  });
  router.post('/lessons/:lessonId/complete', async (req, res) => {
    const { timeSpentSeconds } = completeSchema.parse(req.body ?? {});
    res.json(await services.learning.completeLesson(userIdOf(res), id.parse(req.params.lessonId), timeSpentSeconds));
  });
  router.post('/lessons/:lessonId/explain', aiLimiter, async (req, res) => {
    const { attempt } = attemptSchema.parse(req.body ?? {});
    res.json(await services.learning.explainAgain(userIdOf(res), id.parse(req.params.lessonId), attempt));
  });
  router.post('/lessons/:lessonId/example', aiLimiter, async (req, res) => {
    const { attempt } = attemptSchema.parse(req.body ?? {});
    res.json(await services.learning.anotherExample(userIdOf(res), id.parse(req.params.lessonId), attempt));
  });

  // Vocabulário
  router.get('/vocabulary', async (_req, res) => {
    res.json(await services.vocabulary.list(userIdOf(res)));
  });
  router.get('/vocabulary/:wordId', async (req, res) => {
    res.json(await services.vocabulary.get(userIdOf(res), id.parse(req.params.wordId)));
  });
  router.put('/vocabulary/:wordId/status', async (req, res) => {
    const { status } = vocabularyStatusSchema.parse(req.body);
    res.json(await services.vocabulary.setStatus(userIdOf(res), id.parse(req.params.wordId), status));
  });

  // Revisão
  router.get('/reviews', async (_req, res) => {
    res.json(await services.review.queue(userIdOf(res)));
  });
  router.post('/reviews/:reviewId/session', async (req, res) => {
    res.json(await services.review.startSession(userIdOf(res), id.parse(req.params.reviewId)));
  });
  router.post('/reviews/:reviewId/answers', aiLimiter, async (req, res) => {
    const { exerciseId, answer } = reviewAnswerSchema.parse(req.body);
    res.json(await services.review.answer(userIdOf(res), id.parse(req.params.reviewId), exerciseId, answer));
  });
  router.post('/reviews/:reviewId/complete', async (req, res) => {
    res.json(await services.review.complete(userIdOf(res), id.parse(req.params.reviewId), reviewCompleteSchema.parse(req.body)));
  });

  return router;
}
