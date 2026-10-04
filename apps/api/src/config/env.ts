import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/** Variáveis vazias no .env (ex.: `SMTP_HOST=`) contam como não definidas. */
const optionalText = z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().optional());
const flag = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
);

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

  // E-mail (ver docs/EMAIL-AND-AUTH.md)
  MAIL_TRANSPORT: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.enum(['smtp', 'outbox', 'disabled']).optional(),
  ),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(1).max(65535).default(587),
  ),
  SMTP_SECURE: flag,
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  MAIL_FROM: optionalText,
  APP_PUBLIC_URL: optionalText,
  MAIL_OUTBOX_DIR: z.string().default('./data/outbox'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
});

export interface MailConfig {
  transport: 'smtp' | 'outbox' | 'disabled';
  /** Endereço público do front-end, usado nos links dos e-mails. Nunca vem do cabeçalho Host da requisição. */
  appUrl: string;
  from: string;
  outboxDir: string;
  smtp: { host: string; port: number; secure: boolean; requireTLS: boolean; user?: string; password?: string } | null;
}

const DEV_FROM = 'English AI <no-reply@english-ai.local>';

type ParsedEnv = z.infer<typeof schema>;
type MailEnv = 'MAIL_TRANSPORT' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_SECURE' | 'SMTP_USER' | 'SMTP_PASSWORD' | 'MAIL_FROM' | 'APP_PUBLIC_URL' | 'MAIL_OUTBOX_DIR';

export type AppConfig = Omit<ParsedEnv, 'AUTH_TOKEN_SECRET' | MailEnv> & {
  AUTH_TOKEN_SECRET: string;
  isProduction: boolean;
  mail: MailConfig;
  warnings: string[];
};

function resolveMail(config: ParsedEnv, isProduction: boolean, warnings: string[]): MailConfig {
  const host = config.SMTP_HOST?.trim();
  // Padrão: SMTP se configurado; caixa de saída local só em desenvolvimento; nos demais casos, nada é enviado.
  const transport = config.MAIL_TRANSPORT ?? (host ? 'smtp' : config.NODE_ENV === 'development' ? 'outbox' : 'disabled');

  if (transport === 'outbox' && isProduction) {
    throw new Error('MAIL_TRANSPORT=outbox (caixa de saída local) não pode ser usado em produção. Configure SMTP_HOST.');
  }
  if (transport === 'smtp' && !host) throw new Error('MAIL_TRANSPORT=smtp exige SMTP_HOST.');
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    throw new Error('Defina SMTP_USER e SMTP_PASSWORD juntos (ou nenhum dos dois).');
  }

  let appUrl = config.APP_PUBLIC_URL?.trim();
  if (!appUrl) {
    if (isProduction && transport === 'smtp') throw new Error('APP_PUBLIC_URL é obrigatório em produção para montar os links dos e-mails.');
    appUrl = config.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173';
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(appUrl);
  } catch {
    throw new Error('APP_PUBLIC_URL precisa ser um endereço completo, como https://englishai.exemplo.com.');
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('APP_PUBLIC_URL precisa usar http ou https.');
  if (isProduction && parsedUrl.protocol !== 'https:') warnings.push('APP_PUBLIC_URL sem https em produção: os links dos e-mails não serão protegidos.');

  const from = config.MAIL_FROM?.trim();
  if (!from && isProduction && transport === 'smtp') throw new Error('MAIL_FROM é obrigatório em produção (ex.: English AI <no-reply@seudominio.com>).');

  if (transport === 'disabled' && config.NODE_ENV !== 'test') {
    warnings.push('Envio de e-mails desativado: boas-vindas e recuperação de senha não serão enviados (configure SMTP_HOST).');
  }
  if (transport === 'outbox') {
    warnings.push(`E-mails de desenvolvimento ficam na pasta ${config.MAIL_OUTBOX_DIR} (nenhum e-mail real é enviado).`);
  }

  return {
    transport,
    appUrl: parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, ''),
    from: from || DEV_FROM,
    outboxDir: config.MAIL_OUTBOX_DIR,
    smtp:
      transport === 'smtp' && host
        ? {
            host,
            port: config.SMTP_PORT,
            secure: config.SMTP_SECURE,
            // Em produção, STARTTLS é obrigatório; em desenvolvimento aceita servidores locais sem TLS (ex.: Mailpit).
            requireTLS: isProduction,
            ...(config.SMTP_USER ? { user: config.SMTP_USER, password: config.SMTP_PASSWORD ?? '' } : {}),
          }
        : null,
  };
}

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

  const mail = resolveMail(config, isProduction, warnings);
  const {
    MAIL_TRANSPORT: _transport,
    SMTP_HOST: _host,
    SMTP_PORT: _port,
    SMTP_SECURE: _secure,
    SMTP_USER: _user,
    SMTP_PASSWORD: _password,
    MAIL_FROM: _from,
    APP_PUBLIC_URL: _appUrl,
    MAIL_OUTBOX_DIR: _outbox,
    ...rest
  } = config;
  return { ...rest, AUTH_TOKEN_SECRET: secret, isProduction, mail, warnings };
}
