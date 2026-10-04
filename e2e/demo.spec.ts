import { DEMO, EXPIRED_MESSAGE, expect, exploreDemo, signIn, signOut, test } from './fixtures';

/** Modo demonstração: dados no localStorage deste navegador, IA de demonstração. */

test('demonstração: navegar pelas telas principais e sair da conta', async ({ page, consoleErrors }) => {
  await exploreDemo(page);
  for (const [link, heading] of [
    ['Aprender', 'Sua trilha de aprendizado'],
    ['Conversar', 'Converse em inglês, sem medo de errar'],
    ['Progresso', 'Seu progresso'],
    ['Perfil', 'Perfil'],
    ['Início', /Alex/],
  ] as const) {
    await page.getByRole('link', { name: link }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }

  await signOut(page);
  await expect(page.getByText('Você saiu da sua conta.')).toBeVisible();
  await expect(page.getByText(/sessão expirou/i)).toHaveCount(0);

  // Voltar não revela dados privados; rota protegida leva ao login.
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText(/\bAlex\b/)).toHaveCount(0);

  // A demonstração continua disponível depois de sair.
  await exploreDemo(page);
  expect(consoleErrors).toEqual([]);
});

test('seleção de texto: a interface não é selecionável; campos continuam selecionáveis', async ({ page, consoleErrors }) => {
  await exploreDemo(page);
  const title = page.getByRole('heading', { level: 1 });
  expect(await title.evaluate((element) => getComputedStyle(element).userSelect)).toBe('none');

  // Clicar e arrastar sobre o título não seleciona nada.
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('');

  // Campos de texto: seleção e edição normais.
  await page.getByRole('link', { name: 'Perfil' }).first().click();
  await page.getByRole('link', { name: /Vocabulário/ }).first().click();
  const search = page.getByLabel('Buscar palavra');
  await search.fill('kitchen');
  expect(await search.evaluate((element) => getComputedStyle(element).userSelect)).toBe('text');
  await search.selectText();
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value.slice(0, (document.activeElement as HTMLInputElement).selectionEnd ?? 0))).toBe('kitchen');
  expect(consoleErrors).toEqual([]);
});

test('sessão expirada: uma transição para o login, uma mensagem e retorno à página', async ({ page, consoleErrors }) => {
  await exploreDemo(page);
  await page.evaluate(() => localStorage.removeItem('english-ai:v1:session'));
  await page.getByRole('link', { name: 'Progresso' }).first().click();

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText(EXPIRED_MESSAGE)).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);

  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/progresso$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Seu progresso' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('outra aba sai da conta: esta aba vai ao login, sem aviso de expiração', async ({ page, context, consoleErrors }) => {
  await exploreDemo(page);
  await page.getByRole('link', { name: 'Progresso' }).first().click();

  const other = await context.newPage();
  await other.goto('/perfil');
  await other.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(other).toHaveURL(/\/entrar$/);

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText(/sessão expirou/i)).toHaveCount(0);
  await expect(page.getByText(/\bAlex\b/)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('login incorreto e correto; Enter envia o formulário', async ({ page, consoleErrors }) => {
  await signIn(page, DEMO.email, 'senha-errada1');
  await expect(page.getByText('E-mail ou senha incorretos. Tente novamente.')).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');

  await exploreDemo(page); // garante a conta de demonstração neste navegador
  await signOut(page);
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: /Alex/ })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('sem rolagem horizontal nas telas principais em 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const path of ['/', '/entrar', '/cadastro']) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
  await exploreDemo(page);
  for (const path of ['/inicio', '/aprender', '/conversar', '/progresso', '/perfil', '/vocabulario', '/revisao', '/preferencias', '/privacidade']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});
