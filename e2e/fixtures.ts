import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

/** Página com coleta de erros do console (o uso normal do app não deve gerar nenhum). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
});

export { expect };

export const DEMO = { email: 'alex@demo.englishai.app', password: 'demo1234' };
export const PASSWORD = 'segura123';
export const EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.';

export async function signUp(page: Page, name: string, email: string) {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirme a senha').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/configuracao$/);
}

/** Configuração inicial + "Prefiro começar do zero" no nivelamento → Início. */
export async function finishFirstAccess(page: Page, name: string) {
  await page.getByText('Conversar', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Básico', { exact: true }).click();
  await page.getByRole('button', { name: 'Estudei na escola' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Salvar e fazer o nivelamento/ }).click();
  await page.getByRole('button', { name: 'Prefiro começar do zero' }).click();
  await page.getByRole('button', { name: 'Ir para o início' }).click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function signOut(page: Page) {
  await page.getByRole('link', { name: 'Perfil' }).first().click();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
}

export async function exploreDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar demonstração/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Alex/ })).toBeVisible();
}

/** Caixa de saída local do servidor http dos testes (ver start-http-server.mjs). */
const OUTBOX = join(dirname(fileURLToPath(import.meta.url)), '.output', 'http', 'outbox');

interface OutboxMessage {
  to: string;
  kind: 'welcome' | 'password_reset';
  subject: string;
  text: string;
  html: string;
}

/** E-mails gravados para o endereço (mais antigo primeiro). */
export function outboxFor(email: string, kind?: OutboxMessage['kind']): OutboxMessage[] {
  if (!existsSync(OUTBOX)) return [];
  return readdirSync(OUTBOX)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(OUTBOX, file), 'utf8')) as OutboxMessage)
    .filter((message) => message.to === email && (!kind || message.kind === kind));
}

/** Link de redefinição do último e-mail de recuperação (o envio é assíncrono, então espera chegar). */
export async function resetLinkFor(email: string): Promise<string> {
  const pattern = /https?:\/\/\S+\/redefinir-senha\/[A-Za-z0-9_-]{43}/;
  await expect.poll(() => outboxFor(email, 'password_reset').at(-1)?.text ?? '', { timeout: 10_000 }).toMatch(pattern);
  return (outboxFor(email, 'password_reset').at(-1)?.text.match(pattern) ?? [''])[0];
}

export async function fillNewPassword(page: Page, password: string) {
  await page.getByLabel('Nova senha', { exact: true }).fill(password);
  await page.getByLabel('Confirme a nova senha').fill(password);
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
}
