import type { RenderedEmail } from '../types';
import { button, escapeHtml, firstNameOf, heading, linkFallback, notice, paragraph, renderLayout, TEXT_FOOTER } from './layout';

export interface PasswordResetEmailInput {
  name: string;
  /** Link completo com o token (só existe neste e-mail). */
  resetUrl: string;
  expiresInMinutes: number;
  appUrl: string;
}

/** Link de redefinição de senha: validade curta, uso único, sem senha no conteúdo. */
export function passwordResetEmail({ name, resetUrl, expiresInMinutes, appUrl }: PasswordResetEmailInput): RenderedEmail {
  const first = firstNameOf(name);
  const hello = first ? `Olá, ${first}.` : 'Olá.';
  const validity = `Este link vale por ${expiresInMinutes} minutos e só pode ser usado uma vez.`;

  const bodyHtml = [
    heading('Redefinir sua senha'),
    paragraph(`${escapeHtml(hello)} Recebemos um pedido para redefinir a senha da sua conta no <strong>English AI</strong>.`),
    button('Redefinir senha', resetUrl),
    notice(`<strong>${escapeHtml(validity)}</strong> Se ele vencer, peça um novo na tela “Esqueci minha senha”.`),
    linkFallback(resetUrl),
    paragraph('Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.'),
  ].join('\n');

  const text = [
    hello,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no English AI.',
    '',
    `Redefinir senha: ${resetUrl}`,
    '',
    `${validity} Se ele vencer, peça um novo na tela "Esqueci minha senha".`,
    '',
    'Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.',
    '',
    TEXT_FOOTER,
  ].join('\n');

  return {
    subject: 'Redefinição de senha — English AI',
    html: renderLayout({ preheader: `Link para criar uma nova senha. ${validity}`, bodyHtml, appUrl }),
    text,
  };
}
