// Small cross-engine smoke, not the Chromium regression or a Safari/iOS certification.
import {test, expect} from '@playwright/test';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const artifact = pathToFileURL(path.resolve('dist/preview.html')).href;

test('portable product opens, edits and saves in the selected engine', async ({page, context}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {if (message.type() === 'error') errors.push(message.text());});
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file:|data:|blob:)/.test(url)) return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.goto(artifact);
  await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
  await page.getByRole('navigation', {name: 'Principal'}).getByRole('button', {name: 'Ir al turno actual'}).click();
  const title = page.getByRole('textbox', {name: 'Título de tarea'});
  await expect(title).toHaveValue('Tarea 1');
  await title.fill('Tarea editada en smoke');
  const save = page.getByRole('button', {name: 'Guardar', exact: true});
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await expect(title).toHaveValue('Tarea editada en smoke');
  await expect(page).toHaveTitle('Tarea editada en smoke · Turno');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
