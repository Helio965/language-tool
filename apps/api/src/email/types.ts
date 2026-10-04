/**
 * Contratos da camada de e-mail. As rotas nunca falam com SMTP: chamam o EmailService,
 * que monta a mensagem a partir de um template e entrega a um Mailer.
 */

export type EmailKind = 'welcome' | 'password_reset';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Versão em texto puro (clientes sem HTML, leitores de tela, filtros de spam). */
  text: string;
  /** Categoria usada em logs e testes — nunca o conteúdo. */
  kind: EmailKind;
}

/**
 * - smtp: envio real (produção).
 * - outbox: grava os e-mails em uma pasta local (desenvolvimento; proibido em produção).
 * - memory: guarda em memória (testes automatizados).
 * - disabled: não envia nada (produção sem SMTP configurado).
 */
export type MailTransport = 'smtp' | 'outbox' | 'memory' | 'disabled';

export interface Mailer {
  readonly transport: MailTransport;
  send(message: EmailMessage): Promise<void>;
}

/** Template renderizado: assunto + corpo em HTML e em texto. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
