import { AppError, USER_MESSAGES, type ErrorCode } from '@english-ai/core';

/** Erro uniforme para a interface, independente do modo (demo ou http). */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AppError) {
    const fields = error.fields ?? {};
    const single = Object.values(fields);
    const message = error.code === 'VALIDATION' && single.length === 1 ? (single[0] as string) : USER_MESSAGES[error.code];
    return new ApiError(error.code, message, fields);
  }
  return new ApiError('INTERNAL', USER_MESSAGES.INTERNAL);
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}
