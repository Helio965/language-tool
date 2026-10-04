import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, Mailer } from './types';

export interface SmtpSettings {
  host: string;
  port: number;
  /** true = TLS desde a conexão (porta 465); false = STARTTLS (porta 587). */
  secure: boolean;
  /** Exige STARTTLS quando `secure` é false (ligado em produção). */
  requireTLS: boolean;
  user?: string;
  password?: string;
  from: string;
}

/** Envio real por SMTP (nodemailer). Credenciais só no backend, vindas do .env. */
export class SmtpMailer implements Mailer {
  readonly transport = 'smtp' as const;
  private readonly transporter: Transporter;

  constructor(
    private readonly settings: SmtpSettings,
    transporter?: Transporter,
  ) {
    this.transporter =
      transporter ??
      createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        requireTLS: !settings.secure && settings.requireTLS,
        ...(settings.user ? { auth: { user: settings.user, pass: settings.password ?? '' } } : {}),
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        // Nunca registrar a conversa SMTP: ela inclui a autenticação (credencial em base64).
        logger: false,
        debug: false,
        // O conteúdo é gerado pelo próprio sistema; nada de anexos vindos de arquivos ou URLs.
        disableFileAccess: true,
        disableUrlAccess: true,
      });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/**
 * Caixa de saída local para desenvolvimento: cada e-mail vira um .json (para scripts e testes E2E)
 * e um .html (para abrir no navegador e clicar no link). Nada é enviado. Proibida em produção
 * (ver config/env.ts) e gravada em data/, que não é versionada.
 */
export class OutboxMailer implements Mailer {
  readonly transport = 'outbox' as const;
  readonly directory: string;

  constructor(
    directory: string,
    private readonly from: string,
    private readonly onSaved?: (file: string) => void,
  ) {
    this.directory = resolve(directory);
  }

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const createdAt = new Date().toISOString();
    const base = `${createdAt.replace(/[:.]/g, '-')}-${message.kind}-${randomBytes(3).toString('hex')}`;
    const record = { createdAt, from: this.from, ...message };
    await writeFile(join(this.directory, `${base}.json`), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await writeFile(join(this.directory, `${base}.html`), message.html, { mode: 0o600 });
    this.onSaved?.(join(this.directory, `${base}.html`));
  }
}

/** Caixa de saída em memória para testes automatizados: nada sai do processo. */
export class MemoryMailer implements Mailer {
  readonly transport = 'memory' as const;
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }

  /** Último e-mail enviado para o endereço (ou undefined). */
  lastTo(address: string): EmailMessage | undefined {
    return this.messages.filter((message) => message.to === address).at(-1);
  }

  clear(): void {
    this.messages.length = 0;
  }
}

/** Produção sem SMTP configurado: nenhum envio (o EmailService registra que o e-mail foi descartado). */
export class DisabledMailer implements Mailer {
  readonly transport = 'disabled' as const;

  async send(): Promise<void> {}
}
