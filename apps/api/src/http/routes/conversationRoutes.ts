/**
 * UC09 — Conversar com IA, com histórico controlado pelo usuário (RN07).
 */
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AppServices } from '@english-ai/core';
import { requireAuth, userIdOf } from '../middleware/security';

const id = z.string().min(1).max(80);
const startSchema = z.object({ topicId: z.string().min(1).max(80) });
const messageSchema = z.object({ text: z.string().max(2000) });

export function conversationRoutes(deps: { services: AppServices; aiLimiter: RequestHandler }): Router {
  const { services, aiLimiter } = deps;
  const router = Router();
  router.use(['/conversation-topics', '/conversations'], requireAuth);

  router.get('/conversation-topics', async (_req, res) => {
    res.json(await services.conversation.listTopics(userIdOf(res)));
  });
  router.get('/conversations', async (_req, res) => {
    res.json(await services.conversation.list(userIdOf(res)));
  });
  router.post('/conversations', aiLimiter, async (req, res) => {
    res.status(201).json(await services.conversation.start(userIdOf(res), startSchema.parse(req.body).topicId));
  });
  router.delete('/conversations', async (_req, res) => {
    res.json({ deleted: await services.conversation.removeAll(userIdOf(res)) });
  });
  router.get('/conversations/:conversationId', async (req, res) => {
    res.json(await services.conversation.get(userIdOf(res), id.parse(req.params.conversationId)));
  });
  router.post('/conversations/:conversationId/messages', aiLimiter, async (req, res) => {
    const { text } = messageSchema.parse(req.body);
    res.status(201).json(await services.conversation.send(userIdOf(res), id.parse(req.params.conversationId), text));
  });
  router.post('/conversations/:conversationId/end', async (req, res) => {
    res.json(await services.conversation.end(userIdOf(res), id.parse(req.params.conversationId)));
  });
  router.delete('/conversations/:conversationId', async (req, res) => {
    await services.conversation.remove(userIdOf(res), id.parse(req.params.conversationId));
    res.status(204).end();
  });

  return router;
}
