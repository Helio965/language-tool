import type { Page } from '@playwright/test';
import { EXPIRED_MESSAGE, expect, finishFirstAccess, PASSWORD, signIn, signOut, signUp, test } from './fixtures';

/** Modo http: API + SQLite + sessão em cookie httpOnly. */

const unique = (name: string) => `${name.toLowerCase()}.${Date.now()}@example.com`;

/** Respostas da API privada (tudo menos sessão/login/logout) observadas a partir de agora. */
function trackPrivateRequests(page: Page) {
  const seen: string[] = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) seen.push(`${response.request().method()} ${path} ${response.status()}`);
  });
  return seen;
}

async function completeFirstLesson(page: Page) {
  await page.goto('/aprender/aula/greetings');
  await page.getByRole('button', { name: /Começar aula/ }).click();
  await page.getByRole('button', { name: 'Ver exemplos' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Ir para os exercícios/ }).click();
  for (let i = 0; i < 12 && (await page.getByRole('button', { name: 'Verificar' }).isVisible()); i++) {
    const text = page.locator('textarea');
    const blank = page.getByLabel('Complete a lacuna');
    if (await text.isVisible()) await text.fill('Hello, my name is Ana.');
    else if (await blank.isVisible()) await blank.fill('is');
    else await page.locator('fieldset label').first().click();
    await page.getByRole('button', { name: 'Verificar' }).click();
    await page.getByRole('button', { name: /Continuar|Ver resumo da aula/ }).last().click();
  }
  await expect(page.getByText('Aula concluída', { exact: true })).toBeVisible();
}

test('cadastro completo; recarregar mantém a conta; sessão só em cookie httpOnly', async ({ page, context, consoleErrors }) => {
  await signUp(page, 'Ana', unique('ana'));
  await finishFirstAccess(page, 'Ana');

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'ea_session')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /session|token/i.test(key)))).toEqual([]);

  for (const path of ['/inicio', '/aprender', '/conversar', '/progresso', '/perfil', '/vocabulario', '/revisao', '/preferencias', '/privacidade']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect(consoleErrors).toEqual([]);
});

test('logout: nenhuma requisição privada depois, e Voltar não revela dados', async ({ page, consoleErrors }) => {
  await signUp(page, 'Bel', unique('bel'));
  await finishFirstAccess(page, 'Bel');
  await page.getByRole('link', { name: 'Progresso' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Seu progresso' })).toBeVisible();

  await page.getByRole('link', { name: 'Perfil' }).first().click();
  const afterLogout = trackPrivateRequests(page);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText(/\bBel\b/)).toHaveCount(0);
  expect(afterLogout).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('troca de conta: B não vê dados de A; A volta com seus dados', async ({ page, consoleErrors }) => {
  const ana = unique('ana');
  const bruno = unique('bruno');
  await signUp(page, 'Ana', ana);
  await finishFirstAccess(page, 'Ana');
  await completeFirstLesson(page);
  await page.goto('/progresso');
  await expect(page.getByText('1 de 5 aulas do nível Iniciante concluídas')).toBeVisible();

  await signOut(page);
  await signUp(page, 'Bruno', bruno);
  await finishFirstAccess(page, 'Bruno');
  await page.goto('/progresso');
  await expect(page.getByText('Nada por aqui ainda')).toBeVisible();
  await page.goto('/vocabulario');
  await expect(page.getByText('Seu vocabulário começa na primeira aula')).toBeVisible();
  await page.goto('/perfil');
  await expect(page.getByText(bruno)).toBeVisible();
  await expect(page.getByText('Ana', { exact: true })).toHaveCount(0);

  await signOut(page);
  await signIn(page, ana);
  await expect(page.getByRole('heading', { level: 1, name: /Ana/ })).toBeVisible();
  await page.goto('/progresso');
  await expect(page.getByText('1 de 5 aulas do nível Iniciante concluídas')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('sessão expirada (cookie removido): login com uma mensagem e retorno à página', async ({ page, context, consoleErrors }) => {
  const email = unique('caio');
  await signUp(page, 'Caio', email);
  await finishFirstAccess(page, 'Caio');

  await context.clearCookies();
  await page.getByRole('link', { name: 'Conversar' }).first().click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText(EXPIRED_MESSAGE)).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/conversar$/);
  // O único erro de console aceito é a resposta 401 que revelou a expiração.
  expect(consoleErrors.filter((error) => !/401/.test(error))).toEqual([]);
});

test('excluir a conta: vira visitante, Voltar não revela dados e o login é recusado', async ({ page, consoleErrors }) => {
  const email = unique('duda');
  await signUp(page, 'Duda', email);
  await finishFirstAccess(page, 'Duda');
  await page.goto('/privacidade');
  await page.getByRole('button', { name: /Excluir minha conta/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=password]').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Sua conta e seus dados foram excluídos.')).toBeVisible();
  await page.goBack();
  await expect(page.getByText(email)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Privacidade e dados' })).toHaveCount(0);

  await signIn(page, email);
  await expect(page.getByText('E-mail ou senha incorretos. Tente novamente.')).toBeVisible();
  // O único erro de console aceito é o 401 do login recusado.
  expect(consoleErrors.filter((error) => !/401/.test(error))).toEqual([]);
});
