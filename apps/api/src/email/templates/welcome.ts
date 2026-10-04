import type { RenderedEmail } from '../types';
import { button, EMAIL_COLORS, firstNameOf, heading, notice, paragraph, renderLayout, TEXT_FOOTER } from './layout';

export interface WelcomeEmailInput {
  name: string;
  appUrl: string;
}

/** Boas-vindas após o cadastro. Não contém senha nem link de uso único. */
export function welcomeEmail({ name, appUrl }: WelcomeEmailInput): RenderedEmail {
  const first = firstNameOf(name);
  const startUrl = `${appUrl}/entrar`;
  const greeting = first ? `Boas-vindas, ${first}!` : 'Boas-vindas!';

  const bodyHtml = [
    heading(greeting),
    paragraph(
      'Sua conta no <strong>English AI</strong> foi criada. Aqui você aprende inglês no seu ritmo, com aulas curtas, conversa com a IA e correções que explicam o porquê — em português quando você precisa.',
    ),
    paragraph('Os próximos passos levam poucos minutos:'),
    `<ol style="margin:0 0 20px;padding-left:22px;font-size:16px;line-height:1.7;color:${EMAIL_COLORS.ink2};">
  <li>conte qual é o seu objetivo com o inglês;</li>
  <li>faça o nivelamento (ou comece do zero);</li>
  <li>escolha entre aprender com uma aula ou conversar com a IA.</li>
</ol>`,
    button('Começar a estudar', startUrl),
    notice(
      'Por segurança, nunca enviamos sua senha por e-mail. Se não foi você quem criou esta conta, ignore esta mensagem.',
    ),
  ].join('\n');

  const text = [
    greeting,
    '',
    'Sua conta no English AI foi criada. Aqui você aprende inglês no seu ritmo, com aulas curtas, conversa com a IA e correções que explicam o porquê.',
    '',
    'Próximos passos:',
    '1. conte qual é o seu objetivo com o inglês;',
    '2. faça o nivelamento (ou comece do zero);',
    '3. escolha entre aprender com uma aula ou conversar com a IA.',
    '',
    `Começar a estudar: ${startUrl}`,
    '',
    'Por segurança, nunca enviamos sua senha por e-mail. Se não foi você quem criou esta conta, ignore esta mensagem.',
    '',
    TEXT_FOOTER,
  ].join('\n');

  return {
    subject: 'Boas-vindas ao English AI',
    html: renderLayout({ preheader: `${greeting} Sua conta está pronta.`, bodyHtml, appUrl }),
    text,
  };
}
