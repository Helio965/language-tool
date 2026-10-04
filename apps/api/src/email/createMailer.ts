import type { MailConfig } from '../config/env';
import type { Logger } from '../logger';
import { DisabledMailer, OutboxMailer, SmtpMailer } from './mailers';
import type { Mailer } from './types';

/** Escolhe a implementação de Mailer a partir da configuração validada (config/env.ts). */
export function createMailer(mail: MailConfig, logger: Logger): Mailer {
  if (mail.transport === 'smtp' && mail.smtp) return new SmtpMailer({ ...mail.smtp, from: mail.from });
  if (mail.transport === 'outbox') {
    return new OutboxMailer(mail.outboxDir, mail.from, (file) => logger.info('email.outbox', { file }));
  }
  return new DisabledMailer();
}
