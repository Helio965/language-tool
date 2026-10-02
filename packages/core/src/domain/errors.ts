/**
 * Erros de aplicação com código estável. A API converte o código em status HTTP
 * e o front-end converte em mensagens amigáveis — nenhum detalhe técnico chega ao usuário.
 */
export const ERROR_CODES = {
  VALIDATION: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_IN_USE: 409,
  CONVERSATION_ENDED: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields: FieldErrors | undefined;

  constructor(code: ErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }

  get status(): number {
    return ERROR_CODES[this.code];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Mensagens exibidas ao usuário para cada código (pt-BR). */
export const USER_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'Confira os campos destacados.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos. Tente novamente.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente para continuar.',
  FORBIDDEN: 'Você não tem acesso a este conteúdo.',
  NOT_FOUND: 'Não encontramos o que você procurava.',
  EMAIL_IN_USE: 'Já existe uma conta com este e-mail.',
  CONVERSATION_ENDED: 'Esta conversa já foi encerrada.',
  RATE_LIMITED: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
  AI_UNAVAILABLE: 'A IA está indisponível no momento. Tente novamente em instantes.',
  INTERNAL: 'Algo deu errado do nosso lado. Tente novamente.',
};
