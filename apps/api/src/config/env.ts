import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Configuração centralizada e validada na inicialização. Segredos vêm apenas de variáveis
 * de ambiente (.env local, nunca versionado). Ver .env.example.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AUTH_TOKEN_SECRET: z.string().optional(),
  AUTH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(72),
  DATABASE_PATH: z.string().default('./data/english-ai.db'),
  CONVERSATION_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(90),
  AI_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  AI_MAX_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(50).default(12),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
  WEB_DIST_PATH: z.string().optional(),
});

export type AppConfig = Omit<z.infer<typeof schema>, 'AUTH_TOKEN_SECRET'> & {
  AUTH_TOKEN_SECRET: string;
  isProduction: boolean;
  warnings: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuração inválida nas variáveis: ${fields}`);
  }
  const config = parsed.data;
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  let secret = config.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    if (isProduction) throw new Error('AUTH_TOKEN_SECRET é obrigatório em produção.');
    secret = randomBytes(48).toString('base64url');
    warnings.push('AUTH_TOKEN_SECRET não definido: usando segredo temporário (sessões expiram ao reiniciar).');
  } else if (secret.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET precisa ter pelo menos 32 caracteres.');
  }

  if (config.AI_PROVIDER === 'anthropic' && !config.ANTHROPIC_API_KEY) {
    warnings.push('AI_PROVIDER=anthropic sem ANTHROPIC_API_KEY: usando o modo demonstração.');
  }

  return { ...config, AUTH_TOKEN_SECRET: secret, isProduction, warnings };
}
