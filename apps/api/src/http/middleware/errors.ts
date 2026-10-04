import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isAppError, USER_MESSAGES } from '@english-ai/core';
import type { Logger } from '../../logger';

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

/** Converte qualquer erro em resposta JSON estável, sem expor detalhes internos. */
export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      const body: ErrorBody = { error: { code: error.code, message: USER_MESSAGES[error.code] ?? error.message } };
      if (error.fields) body.error.fields = error.fields;
      if (error.code === 'VALIDATION' && error.fields && Object.keys(error.fields).length === 1) {
        body.error.message = Object.values(error.fields)[0] ?? body.error.message;
      }
      return res.status(error.status).json(body);
    }
    if (error instanceof ZodError) {
      const fields = Object.fromEntries(error.issues.map((issue) => [issue.path.join('.') || 'body', 'Valor inválido.']));
      return res.status(400).json({ error: { code: 'VALIDATION', message: USER_MESSAGES.VALIDATION, fields } } satisfies ErrorBody);
    }
    const status = (error as { status?: number; type?: string })?.status;
    if (status === 400 || status === 413) {
      // JSON malformado ou corpo grande demais (body-parser).
      return res.status(status).json({ error: { code: 'VALIDATION', message: 'Requisição inválida.' } } satisfies ErrorBody);
    }
    logger.error('http.unhandled_error', {
      method: req.method,
      path: req.route?.path ?? req.path,
      name: error instanceof Error ? error.name : 'unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: { code: 'INTERNAL', message: USER_MESSAGES.INTERNAL } } satisfies ErrorBody);
  };
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: USER_MESSAGES.NOT_FOUND } } satisfies ErrorBody);
}
