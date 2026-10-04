/**
 * Logger estruturado (JSON por linha) com redação de campos sensíveis.
 * Nunca registra senhas, tokens, e-mails ou conteúdo de mensagens.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = /pass(word)?|token|secret|authorization|cookie|email|content|answer|text|api[-_]?key/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1),
    ]),
  );
}

export interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createLogger(options: { silent?: boolean; sink?: (line: string, level: Level) => void } = {}): Logger {
  const sink =
    options.sink ??
    ((line: string, level: Level) => (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`));
  const write = (level: Level, event: string, data: Record<string, unknown> = {}) => {
    if (options.silent) return;
    sink(JSON.stringify({ time: new Date().toISOString(), level, event, ...(redact(data) as object) }), level);
  };
  return {
    debug: (event, data) => write('debug', event, data),
    info: (event, data) => write('info', event, data),
    warn: (event, data) => write('warn', event, data),
    error: (event, data) => write('error', event, data),
  };
}
