import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { createMailer } from '../src/email/createMailer';
import { createEmailService } from '../src/email/emailService';
import { DisabledMailer, MemoryMailer, OutboxMailer, SmtpMailer } from '../src/email/mailers';
import { escapeHtml } from '../src/email/templates/layout';
import { passwordResetEmail } from '../src/email/templates/passwordReset';
import { welcomeEmail } from '../src/email/templates/welcome';
import type { EmailMessage, Mailer } from '../src/email/types';
import { createLogger } from '../src/logger';

const APP_URL = 'https://englishai.example.com';
const TOKEN = 'A'.repeat(43);
const USER = { name: 'Bia Lima', email: 'bia@example.com' };

function captureLogs() {
  const lines: string[] = [];
  return { lines, logger: createLogger({ sink: (line) => lines.push(line) }) };
}

describe('templates de e-mail', () => {
  it('boas-vindas: nome, botão para entrar, aviso de segurança e rodapé — sem senha', () => {
    const email = welcomeEmail({ name: 'Bia Lima', appUrl: APP_URL });
    expect(email.subject).toBe('Boas-vindas ao English AI');
    expect(email.html).toContain('Boas-vindas, Bia!');
    expect(email.html).toContain(`href="${APP_URL}/entrar"`);
    expect(email.html).toContain('nunca enviamos sua senha');
    expect(email.html).toContain('Projeto acadêmico');
    expect(email.text).toContain(`${APP_URL}/entrar`);
    expect(`${email.html}${email.text}`).not.toMatch(/senha:\s|password/i);
  });

  it('recuperação: link com o token, validade, aviso para ignorar — sem senha nem hash', () => {
    const resetUrl = `${APP_URL}/redefinir-senha/${TOKEN}`;
    const email = passwordResetEmail({ name: 'Bia Lima', resetUrl, expiresInMinutes: 15, appUrl: APP_URL });
    expect(email.subject).toBe('Redefinição de senha — English AI');
    expect(email.html).toContain(`href="${resetUrl}"`);
    expect(email.html).toContain('Redefinir senha');
    expect(email.html).toContain('Este link vale por 15 minutos e só pode ser usado uma vez.');
    expect(email.html).toContain('Se você não pediu a redefinição, ignore este e-mail');
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain('15 minutos');
    expect(`${email.html}${email.text}`).not.toMatch(/[0-9a-f]{64}/);
  });

  it('escapa o nome informado pelo usuário (nunca vira HTML)', () => {
    const email = welcomeEmail({ name: '<script>alert(1)</script> "Eve"', appUrl: APP_URL });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;');
  });

  it('usa layout compatível com clientes de e-mail: tabelas, estilos inline, sem CSS ou imagens externas', () => {
    const { html } = welcomeEmail({ name: 'Bia', appUrl: APP_URL });
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain('max-width:600px');
    expect(html).not.toMatch(/<link\b|<img\b|<script\b|<style\b/);
    expect(html).toContain('lang="pt-BR"');
  });
});

describe('EmailService', () => {
  it('monta o link de redefinição a partir de APP_PUBLIC_URL e entrega ao mailer', async () => {
    const mailer = new MemoryMailer();
    const { logger, lines } = captureLogs();
    const service = createEmailService({ mailer, logger, appUrl: `${APP_URL}/` });
    service.sendPasswordReset(USER, TOKEN, 15);
    await service.idle();
    const message = mailer.lastTo(USER.email);
    expect(message).toMatchObject({ to: USER.email, kind: 'password_reset', subject: 'Redefinição de senha — English AI' });
    expect(message?.text).toContain(`${APP_URL}/redefinir-senha/${TOKEN}`);
    // O log registra só o tipo: nem destinatário, nem link, nem token.
    expect(lines.join('\n')).toContain('email.sent');
    expect(lines.join('\n')).not.toContain(USER.email);
    expect(lines.join('\n')).not.toContain(TOKEN);
  });

  it('não bloqueia quem chama e registra a falha só com o código do erro', async () => {
    const failing: Mailer = {
      transport: 'smtp',
      send: async () => {
        throw Object.assign(new Error(`535 auth failed for ${USER.email} pass=segredo`), { code: 'EAUTH' });
      },
    };
    const { logger, lines } = captureLogs();
    const service = createEmailService({ mailer: failing, logger, appUrl: APP_URL });
    expect(() => service.sendWelcome(USER)).not.toThrow();
    await service.idle();
    const log = lines.join('\n');
    expect(log).toContain('"event":"email.failed"');
    expect(log).toContain('"code":"EAUTH"');
    expect(log).not.toContain(USER.email);
    expect(log).not.toContain('segredo');
  });

  it('com o envio desativado, apenas registra que o e-mail não foi enviado', async () => {
    const { logger, lines } = captureLogs();
    const service = createEmailService({ mailer: new DisabledMailer(), logger, appUrl: APP_URL });
    service.sendWelcome(USER);
    await service.idle();
    expect(lines.join('\n')).toContain('email.skipped');
  });
});

describe('mailers', () => {
  it('SMTP: envia remetente, destinatário, assunto, HTML e texto pelo transporte do nodemailer', async () => {
    const transporter = createTransport({ jsonTransport: true });
    const sent: string[] = [];
    const original = transporter.sendMail.bind(transporter);
    transporter.sendMail = (async (options: Parameters<typeof original>[0]) => {
      const info = await original(options);
      sent.push(String((info as { message: string }).message));
      return info;
    }) as typeof transporter.sendMail;
    const mailer = new SmtpMailer(
      { host: 'smtp.example.com', port: 587, secure: false, requireTLS: true, from: 'English AI <no-reply@example.com>' },
      transporter,
    );
    const message: EmailMessage = { to: USER.email, subject: 'Assunto', html: '<p>Olá</p>', text: 'Olá', kind: 'welcome' };
    await mailer.send(message);
    const parsed = JSON.parse(sent[0] ?? '{}') as Record<string, unknown>;
    expect(parsed).toMatchObject({ subject: 'Assunto', html: '<p>Olá</p>', text: 'Olá' });
    expect(JSON.stringify(parsed.from)).toContain('no-reply@example.com');
    expect(JSON.stringify(parsed.to)).toContain(USER.email);
  });

  it('caixa de saída local: grava .json e .html na pasta configurada', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'english-ai-outbox-'));
    const saved: string[] = [];
    const mailer = new OutboxMailer(dir, 'English AI <no-reply@english-ai.local>', (file) => saved.push(file));
    await mailer.send({ to: USER.email, subject: 'Assunto', html: '<p>Olá</p>', text: 'Olá', kind: 'password_reset' });
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(2);
    const json = JSON.parse(readFileSync(join(dir, files.find((f) => f.endsWith('.json')) ?? ''), 'utf8')) as Record<string, unknown>;
    expect(json).toMatchObject({ to: USER.email, subject: 'Assunto', kind: 'password_reset' });
    expect(saved[0]).toMatch(/\.html$/);
  });
});

describe('configuração de e-mail', () => {
  const base = { AUTH_TOKEN_SECRET: 'x'.repeat(48) };

  it('desenvolvimento sem SMTP usa a caixa de saída local; testes não enviam nada', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'development' }).mail).toMatchObject({ transport: 'outbox', appUrl: 'http://localhost:5173' });
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).mail.transport).toBe('disabled');
  });

  it('com SMTP_HOST, usa SMTP; usuário e senha precisam vir juntos', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'development', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true' });
    expect(config.mail).toMatchObject({ transport: 'smtp', smtp: { host: 'smtp.example.com', port: 465, secure: true } });
    expect(() => loadConfig({ ...base, NODE_ENV: 'development', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u' })).toThrow(/juntos/);
    expect(createMailer(config.mail, createLogger({ silent: true })).transport).toBe('smtp');
  });

  it('produção: proíbe a caixa de saída local e exige APP_PUBLIC_URL e MAIL_FROM com SMTP', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => loadConfig({ ...prod, MAIL_TRANSPORT: 'outbox' })).toThrow(/produção/);
    expect(() => loadConfig({ ...prod, SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'a@b.com' })).toThrow(/APP_PUBLIC_URL/);
    expect(() => loadConfig({ ...prod, SMTP_HOST: 'smtp.example.com', APP_PUBLIC_URL: APP_URL })).toThrow(/MAIL_FROM/);
    const ok = loadConfig({ ...prod, SMTP_HOST: 'smtp.example.com', APP_PUBLIC_URL: APP_URL, MAIL_FROM: 'English AI <no-reply@example.com>' });
    expect(ok.mail).toMatchObject({ transport: 'smtp', appUrl: APP_URL, smtp: { requireTLS: true } });
  });

  it('produção sem SMTP: envio desativado com aviso (o sistema continua funcionando)', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'production' });
    expect(config.mail.transport).toBe('disabled');
    expect(config.warnings.some((warning) => warning.includes('desativado'))).toBe(true);
  });

  it('variáveis vazias do .env.example contam como não definidas', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'development', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', APP_PUBLIC_URL: '' });
    expect(config.mail.transport).toBe('outbox');
    expect(() => loadConfig({ ...base, APP_PUBLIC_URL: 'nao-e-url' })).toThrow(/APP_PUBLIC_URL/);
  });

  it('a configuração não expõe a senha do SMTP fora do bloco de e-mail', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'development', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASSWORD: 'segredo-smtp' });
    expect(Object.keys(config)).not.toContain('SMTP_PASSWORD');
    expect(config.mail.smtp?.password).toBe('segredo-smtp');
  });
});
