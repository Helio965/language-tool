/**
 * Ponto único de envio de e-mails transacionais.
 *
 * - NÃO BLOQUEANTE: as rotas disparam e respondem na hora; o envio segue em segundo plano.
 *   Assim o tempo de resposta não muda conforme o e-mail tem conta ou não (anti-enumeração),
 *   e um SMTP lento não trava o cadastro.
 * - FALHA SEGURA: erro de envio nunca desfaz a ação que o originou (a conta continua criada,
 *   o pedido de redefinição continua registrado). O erro vai para o log só com o código.
 * - SEM DADOS SENSÍVEIS NOS LOGS: nem destinatário, nem link, nem token, nem resposta do servidor SMTP.
 */
import type { User } from '@english-ai/core';
import type { Logger } from '../logger';
import { passwordResetEmail } from './templates/passwordReset';
import { welcomeEmail } from './templates/welcome';
import type { EmailKind, Mailer, RenderedEmail } from './types';

type Recipient = Pick<User, 'name' | 'email'>;

export interface EmailService {
  readonly transport: Mailer['transport'];
  /** Boas-vindas após o cadastro (secundário: se falhar, a conta continua válida). */
  sendWelcome(user: Recipient): void;
  /** Link de redefinição de senha. O token entra apenas no link do e-mail. */
  sendPasswordReset(user: Recipient, token: string, expiresInMinutes: number): void;
  /** Aguarda os envios em andamento (testes e desligamento do servidor). */
  idle(): Promise<void>;
}

export function createEmailService(options: { mailer: Mailer; logger: Logger; appUrl: string }): EmailService {
  const { mailer, logger } = options;
  const appUrl = options.appUrl.replace(/\/+$/, '');
  const pending = new Set<Promise<void>>();

  function dispatch(kind: EmailKind, to: string, email: RenderedEmail): void {
    if (mailer.transport === 'disabled') {
      logger.warn('email.skipped', { kind, reason: 'mail_disabled' });
      return;
    }
    const task = mailer
      .send({ ...email, to, kind })
      .then(() => logger.info('email.sent', { kind, transport: mailer.transport }))
      .catch((error: unknown) => {
        // Só o código do erro (ex.: EAUTH, ECONNECTION, ETIMEDOUT): a mensagem pode conter endereço ou resposta do servidor.
        const code = (error as { code?: unknown })?.code;
        logger.error('email.failed', {
          kind,
          transport: mailer.transport,
          code: typeof code === 'string' ? code : error instanceof Error ? error.name : 'unknown',
        });
      })
      .finally(() => pending.delete(task));
    pending.add(task);
  }

  return {
    transport: mailer.transport,
    sendWelcome(user) {
      dispatch('welcome', user.email, welcomeEmail({ name: user.name, appUrl }));
    },
    sendPasswordReset(user, token, expiresInMinutes) {
      const resetUrl = `${appUrl}/redefinir-senha/${encodeURIComponent(token)}`;
      dispatch('password_reset', user.email, passwordResetEmail({ name: user.name, resetUrl, expiresInMinutes, appUrl }));
    },
    async idle() {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}
