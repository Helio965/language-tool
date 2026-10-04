/**
 * Layout base dos e-mails do English AI.
 *
 * Clientes de e-mail (Gmail, Outlook, Apple Mail) ignoram CSS externo e boa parte do CSS moderno,
 * então o layout usa tabelas, estilos inline, largura máxima de 600px e nenhuma imagem externa
 * (a marca é texto). Cores e tipografia seguem design/DESIGN-SYSTEM.md.
 */

export const EMAIL_COLORS = {
  paper: '#f7f3ec',
  surface: '#fffdf9',
  line: '#e4dccd',
  ink: '#1a1f3a',
  ink2: '#464b66',
  ink3: '#62667d',
  learn: '#2f45c6',
  marker: '#ffe27a',
  almost: '#8a4e00',
  almostSoft: '#fdf0d8',
} as const;

const C = EMAIL_COLORS;
const FONT_TEXT = "'Atkinson Hyperlegible Next', 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";

/** Escapa texto para HTML (nomes vêm do usuário e nunca podem virar marcação). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${FONT_DISPLAY};font-size:24px;line-height:1.25;font-weight:600;color:${C.ink};">${escapeHtml(text)}</h1>`;
}

/** Parágrafo a partir de HTML já seguro (use escapeHtml nos trechos dinâmicos). */
export function paragraph(safeHtml: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink2};">${safeHtml}</p>`;
}

/** Botão "à prova de clientes de e-mail": célula de tabela com fundo + link. */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td bgcolor="${C.learn}" style="border-radius:12px;background-color:${C.learn};">
    <a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:${FONT_TEXT};font-size:16px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/** Aviso em destaque (validade do link, segurança). */
export function notice(safeHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td style="padding:14px 16px;background-color:${C.almostSoft};border-left:4px solid ${C.almost};border-radius:8px;font-size:14px;line-height:1.5;color:${C.ink};">${safeHtml}</td></tr>
</table>`;
}

/** Endereço do link em texto, para copiar caso o botão não funcione. */
export function linkFallback(href: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${C.ink3};">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escapeHtml(href)}" style="color:${C.learn};word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

export interface LayoutInput {
  /** Texto curto exibido na prévia da caixa de entrada (oculto no corpo). */
  preheader: string;
  /** Conteúdo já montado com os helpers acima. */
  bodyHtml: string;
  appUrl: string;
}

export function renderLayout({ preheader, bodyHtml, appUrl }: LayoutInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>English AI</title>
</head>
<body style="margin:0;padding:0;background-color:${C.paper};font-family:${FONT_TEXT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paper}" style="background-color:${C.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 4px 16px;">
        <a href="${escapeHtml(appUrl)}" style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:${C.ink};text-decoration:none;">English <span style="background-color:${C.marker};padding:0 4px;border-radius:4px;">AI</span></a>
      </td></tr>
      <tr><td bgcolor="${C.surface}" style="padding:32px 28px;background-color:${C.surface};border:1px solid ${C.line};border-radius:18px;font-family:${FONT_TEXT};">
${bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${C.ink3};font-family:${FONT_TEXT};">
        Este é um e-mail automático do English AI — por favor, não responda.<br>
        Nunca pedimos nem enviamos senhas por e-mail.<br>
        English AI · Projeto acadêmico — MVP em desenvolvimento.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Rodapé da versão em texto puro (mesmas informações do HTML). */
export const TEXT_FOOTER = [
  '—',
  'Este é um e-mail automático do English AI — por favor, não responda.',
  'Nunca pedimos nem enviamos senhas por e-mail.',
  'English AI · Projeto acadêmico — MVP em desenvolvimento.',
].join('\n');

/** Primeiro nome para a saudação (o nome completo não é necessário no e-mail). */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
