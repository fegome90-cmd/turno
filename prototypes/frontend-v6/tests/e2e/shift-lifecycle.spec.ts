// 4B native product preparation, based on T3. Collection is not browser evidence.
// These flows use only the public UI and browser history, never an exposed store.
// Viewport emulation does not certify physical iPhone/Safari, IME or native zoom.
// UI-36 remains preparation for 5A. Titles do not close canonical requirements.
import {test, expect, type Page, type Locator, type TestInfo} from '@playwright/test';
import {createServer, type Server} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const artifact = resolve('dist/preview.html');
const longName = "Preparación y revisión de material · 王秀英 · Seán O'Brien · <organización> / ".repeat(3).trim();
const renameTitle = 'Editar nombre de lista';
const runtime = new WeakMap<Page, {errors: string[]; external: string[]}>();
let server: Server | undefined, httpUrl = '';

test.beforeAll(async () => {
  const html = await readFile(artifact);
  server = createServer((_request, response) => {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); response.end(html);
  });
  const current = server;
  await new Promise<void>((done) => current.listen(0, '127.0.0.1', done));
  const address = current.address();
  if (!address || typeof address === 'string') throw new Error('Missing product port');
  httpUrl = `http://127.0.0.1:${address.port}/preview.html`;
});
test.afterAll(async () => {
  if (server) await new Promise<void>((done, reject) => server!.close((error) => error ? reject(error) : done()));
});
test.beforeEach(async ({page, context}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status);
  page.on('pageerror', (error) => status.errors.push(error.message));
  page.on('console', (message) => {if (message.type() === 'error') status.errors.push(message.text());});
  await context.route('**/*', (route) => {
    const target = route.request().url();
    if (/^(file:|data:|blob:)/.test(target) || target === httpUrl) return route.continue();
    status.external.push(target); return route.abort();
  });
});
test.afterEach(async ({page}, info) => {
  const status = runtime.get(page);
  await info.attach('runtime-errors-and-blocked-requests', {body: JSON.stringify(status, null, 2), contentType: 'application/json'});
  expect(status).toBeDefined(); expect(status!.errors).toEqual([]); expect(status!.external).toEqual([]);
});

const title = (page: Page) => page.getByRole('textbox', {name: 'Título de tarea', exact: true});
const body = (page: Page) => page.getByRole('textbox', {name: 'Notas de la tarea', exact: true});
const nav = (page: Page) => page.getByRole('navigation', {name: 'Principal'});
const modal = (page: Page, name: string) => page.getByRole('dialog', {name, exact: true});
const guard = (page: Page) => modal(page, 'Hay cambios sin guardar');
const rename = (page: Page) => modal(page, renameTitle);
const closeDialog = (page: Page) => modal(page, 'Cerrar turno');

async function load(page: Page, protocol: 'file' | 'http' = 'file') {
  await page.goto(protocol === 'file' ? pathToFileURL(artifact).href : httpUrl);
  await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
}
async function openNav(page: Page) {
  const width = await page.evaluate(() => innerWidth);
  await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode', width < 700 ? 'drawer' : 'column');
  if (width >= 700) {await expect(nav(page)).toBeVisible(); return;}
  const drawer = modal(page, 'Navegación'), disclosure = page.locator('[data-focus-key="open-nav"]');
  // A closing drawer can still be visible. Intention comes from the stable DOM
  // disclosure; the role-based trigger is used only after the drawer is hidden.
  if (await disclosure.getAttribute('aria-expanded') === 'true') {await expect(drawer).toBeVisible(); return;}
  await expect(drawer).toBeHidden();
  const trigger = page.getByRole('button', {name: 'Abrir navegación', exact: true});
  await expect(trigger).toBeVisible(); await trigger.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true'); await expect(drawer).toBeVisible();
}
async function closeNav(page: Page) {
  if (await page.locator('#navigation-panel').getAttribute('data-panel-mode') === 'drawer'
    && await page.locator('[data-focus-key="open-nav"]').getAttribute('aria-expanded') === 'true') {
    await page.getByRole('button', {name: 'Cerrar navegación', exact: true}).click();
    await expect(modal(page, 'Navegación')).toBeHidden();
  }
}
async function select(page: Page, name: string) {
  await openNav(page); await nav(page).getByRole('button', {name, exact: true}).click();
}
async function workspace(page: Page) {await select(page, 'Ir al turno actual'); await expect(title(page)).toHaveValue('Tarea 1');}
async function expandBed(page: Page, name: string) {
  await openNav(page);
  const button = nav(page).getByRole('button', {name, exact: true});
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}
async function openRename(page: Page, label = 'Lista 1') {
  await select(page, `Editar nombre de ${label}`);
}
async function armFailure(page: Page, kind: 'fallo' | 'conflicto') {
  await openNav(page); await nav(page).getByRole('button', {name: 'Más opciones', exact: true}).click();
  await page.getByRole('button', {name: 'Demo local: datos sintéticos'}).click();
  await modal(page, 'Demostración local').getByRole('button', {name: `Simular ${kind}`, exact: true}).click();
  await expect(modal(page, 'Demostración local')).toBeHidden();
  if (await page.evaluate(() => innerWidth >= 700)) await expect(page.locator('[data-focus-key="more-trigger"]')).toBeFocused();
}
async function appearance(page: Page, theme: 'light' | 'dark') {
  await openNav(page); await nav(page).getByRole('button', {name: 'Más opciones', exact: true}).click();
  const control = page.getByRole('combobox', {name: 'Apariencia', exact: true});
  await expect(control).toBeVisible(); await expect(control).toHaveAccessibleName('Apariencia'); await control.selectOption(theme);
  await page.keyboard.press('Escape'); await expect(page.locator('#more-options')).toBeHidden();
  await closeNav(page); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
async function openTime(page: Page) {
  const disclosure = page.locator('[data-focus-key="open-time"]');
  if (await disclosure.getAttribute('aria-expanded') !== 'true') {
    await expect(modal(page, 'Tiempo')).toBeHidden();
    await page.getByRole('button', {name: 'Mostrar Tiempo', exact: true}).click();
  }
  await expect(page.locator('#time-panel')).toBeVisible();
}
async function closeTime(page: Page) {
  if (await page.locator('[data-focus-key="open-time"]').getAttribute('aria-expanded') === 'true') {
    await page.getByRole('button', {name: 'Cerrar Tiempo', exact: true}).click();
    await expect(page.locator('#time-panel')).toBeHidden();
  }
}
async function agenda(page: Page) {
  await openTime(page); await page.getByRole('tab', {name: 'Agenda', exact: true}).click();
  return page.getByRole('tabpanel', {name: 'Agenda', exact: true});
}
async function timeField(page: Page, property: RegExp, label: string) {
  await openTime(page); await page.getByRole('tab', {name: 'Tarea', exact: true}).click();
  const disclosure = page.getByRole('button', {name: property});
  if (await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.click();
  return page.getByLabel(label, {exact: true});
}
async function save(page: Page) {
  await page.getByRole('button', {name: 'Guardar', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled();
  await expect(page.locator('#save-error')).toBeEmpty();
}
async function createName(page: Page, dialogName: string, fieldLabel: string, value: string, action = 'Crear') {
  const dialog = modal(page, dialogName);
  await dialog.getByRole('textbox', {name: fieldLabel, exact: true}).fill(value);
  await dialog.getByRole('button', {name: action, exact: true}).click(); await expect(dialog).toBeHidden();
}
async function openClose(page: Page) {
  await page.locator('.toolbar').getByRole('button', {name: 'Cerrar turno', exact: true}).click();
  await expect(closeDialog(page)).toBeVisible();
}
async function closeShift(page: Page) {
  await openClose(page); await closeDialog(page).getByRole('button', {name: 'Cerrar y archivar', exact: true}).click();
  await expect(closeDialog(page)).toBeHidden(); await expect(page.locator('.home-summary p')).toHaveText('No hay un turno abierto.');
}
async function openArchive(page: Page) {
  await select(page, 'Archivo de turnos anteriores');
  await expect(page.getByRole('heading', {name: 'Turnos anteriores', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Turno de día · 07/11/2026', exact: true}).click();
  await expect(title(page)).toHaveValue('Tarea 1'); await expect(page.locator('.archive-notice')).toBeVisible();
}
async function associatedError(field: Locator, expected: string) {
  await expect(field).toHaveAttribute('aria-invalid', 'true'); await expect(field).toBeFocused();
  const descriptions = await field.evaluate((node) => {
    const ids = `${node.getAttribute('aria-describedby') ?? ''} ${node.getAttribute('aria-errormessage') ?? ''}`.split(/\s+/).filter(Boolean);
    return ids.map((id) => ({id, text: document.getElementById(id)?.textContent ?? '', visible: !!document.getElementById(id)?.getClientRects().length}));
  });
  expect(descriptions.some((entry) => entry.visible && entry.text === expected)).toBe(true);
}
async function graph(page: Page) {
  return page.locator('.navigation .task-row').evaluateAll((rows) => rows.map((row) => ({
    key: row.querySelector('.task-button')?.getAttribute('data-focus-key'),
    group: row.closest('[id^="group-"]')?.id ?? null,
    title: row.querySelector('.task-title')?.textContent,
    priority: row.querySelector('.priority-badge')?.textContent ?? '',
    completed: (row.querySelector('input') as HTMLInputElement).checked,
  })));
}
async function probePreservedFailure(page: Page, label: string) {
  await select(page, 'Agregar nota rápida');
  const dialog = modal(page, 'Nueva nota rápida'), field = dialog.getByRole('textbox', {name: 'Título de nota nueva', exact: true});
  await field.fill(label); await dialog.getByRole('button', {name: 'Crear', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Fallo simulado'); await expect(field).toHaveValue(label);
  await dialog.getByRole('button', {name: 'Cancelar', exact: true}).click(); await expect(dialog).toBeHidden();
  await expect(page.locator('.navigation .tree-task').filter({hasText: label})).toHaveCount(0);
}

for (const protocol of ['file', 'http'] as const) test.describe(`4B public lifecycle · ${protocol}`, () => {
  test.beforeEach(async ({page}) => {await load(page, protocol);});

  test('create validates before the failure fixture, retries in place and keeps duplicate-list identities distinct', async ({page}) => {
    await workspace(page); const before = await graph(page);
    await nav(page).getByRole('button', {name: 'Lista 1', exact: true}).click();
    await expect(nav(page).getByRole('button', {name: 'Lista 1', exact: true})).toHaveAttribute('aria-expanded', 'false');
    await armFailure(page, 'fallo');
    await select(page, 'Agregar tarea a Lista 1');
    const dialog = modal(page, 'Agregar tarea'), original = await dialog.elementHandle();
    const field = dialog.getByRole('textbox', {name: 'Título de tarea nueva', exact: true});
    const input = await field.elementHandle(), submit = dialog.getByRole('button', {name: 'Crear', exact: true});
    await expect(field).toBeFocused(); await field.fill('   '); await submit.click();
    await associatedError(field, 'Título: escribe de 1 a 300 caracteres.'); await expect(field).toHaveValue('   ');
    const raw = '  Tarea literal <sin HTML>  ';
    await field.fill(raw); await submit.click();
    await expect(dialog.getByRole('alert')).toContainText('Fallo simulado'); await expect(submit).toBeEnabled();
    await expect(field).toHaveValue(raw); expect(await graph(page)).toEqual(before);
    expect(await dialog.evaluate((node, prior) => node === prior, original)).toBe(true);
    expect(await field.evaluate((node, prior) => node === prior, input)).toBe(true);
    await submit.click(); await expect(dialog).toBeHidden();
    await expect(title(page)).toHaveValue(raw.trim()); await expect(body(page)).not.toHaveAttribute('readonly');
    await expect(page.locator('.metadata-context')).toHaveText('Lista 1');
    await expect(nav(page).getByRole('button', {name: 'Lista 1', exact: true})).toHaveAttribute('aria-expanded', 'true');
    const task = nav(page).getByRole('button', {name: raw.trim(), exact: true});
    await expect(task).toHaveAttribute('aria-current', 'true');
    const taskKey = await task.getAttribute('data-focus-key'); expect(taskKey).toMatch(/^select-task-/);
    expect((await graph(page)).find((item) => item.key === taskKey)?.group).toBe('group-bed-1');
    await expect(page.locator('.editor sin,.task-tree sin')).toHaveCount(0);
    const withCreated = await graph(page);
    await select(page, 'Agregar lista'); await createName(page, 'Agregar lista', 'Nombre de lista', 'Lista 1');
    const duplicates = nav(page).getByRole('button', {name: 'Editar nombre de Lista 1', exact: true});
    await expect(duplicates).toHaveCount(2);
    const keys = await duplicates.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-focus-key')));
    expect(keys).toContain('rename-bed-1'); expect(keys.every((key) => key?.startsWith('rename-bed-'))).toBe(true);
    expect(new Set(keys).size).toBe(2); expect(await graph(page)).toEqual(withCreated);
    await expect(title(page)).toHaveValue(raw.trim()); await expect(task).toHaveAttribute('aria-current', 'true');
    await select(page, 'Tarea 1'); await expect(page.locator('.metadata-context')).toHaveText('Lista 1');
    await expect(page.locator('#group-bed-1 [data-focus-key="select-task-1"]')).toHaveAttribute('aria-current', 'true');
  });

  test('rename preserves raw errors, literal identity and links; cancel and trim-noop leave the failure fixture armed', async ({page}) => {
    await workspace(page); const before = await graph(page), editor = await body(page).elementHandle();
    await armFailure(page, 'fallo'); await openRename(page);
    const dialog = rename(page), original = await dialog.elementHandle(), field = dialog.getByRole('textbox', {name: 'Nombre de la lista', exact: true});
    const input = await field.elementHandle(), submit = dialog.getByRole('button', {name: 'Guardar nombre', exact: true});
    await expect(field).toHaveValue('Lista 1'); await expect(field).toBeFocused(); await expect(field).toHaveAttribute('maxlength', '300');
    await expect(dialog.locator('label[for="domain-name"]')).toHaveText('Nombre de la lista');
    await expect(dialog.locator('#domain-name-hint')).toHaveText('Las tareas permanecen en esta lista. Solo cambia su nombre en esta demostración.');
    await field.fill('   '); await submit.click();
    await associatedError(field, 'Nombre de la lista: escribe de 1 a 300 caracteres.'); await expect(field).toHaveValue('   ');
    await field.fill(longName); await submit.click();
    await expect(dialog.getByRole('alert')).toContainText('Fallo simulado'); await expect(field).toHaveValue(longName); await expect(submit).toBeEnabled();
    expect(await dialog.evaluate((node, prior) => node === prior, original)).toBe(true);
    expect(await field.evaluate((node, prior) => node === prior, input)).toBe(true);
    await expect(page.locator('[data-focus-key="rename-bed-1"]')).toHaveAttribute('aria-label', 'Editar nombre de Lista 1');
    expect(await graph(page)).toEqual(before);
    await submit.click(); await expect(dialog).toBeHidden();
    await expect(page.locator('[data-focus-key="rename-bed-1"]')).toHaveAccessibleName(`Editar nombre de ${longName}`);
    await expect(page.locator('[aria-controls="group-bed-1"] span')).toHaveText(longName);
    await expect(page.locator('.metadata-context')).toHaveText(longName); await expect(title(page)).toHaveValue('Tarea 1');
    expect(await body(page).evaluate((node, prior) => node === prior, editor)).toBe(true);
    expect(await graph(page)).toEqual(before); await expect(page.locator('[data-focus-key="select-task-1"]')).toHaveAttribute('aria-current', 'true');
    const list = await agenda(page);
    await expect(list.getByRole('button', {name: `Sin hora · Tarea 1 · ${longName}`, exact: true})).toBeVisible();
    await expect(list.getByRole('button', {name: '14:00 · Revisar material · Prioridad Alta · Lista 2', exact: true})).toBeVisible();
    await expect(page.locator('organización')).toHaveCount(0);
    for (const method of ['cancel', 'trim-noop'] as const) {
      await armFailure(page, 'fallo'); await openRename(page, longName);
      await rename(page).getByRole('textbox', {name: 'Nombre de la lista', exact: true}).fill(method === 'cancel' ? 'No confirmado' : ` ${longName} `);
      await rename(page).getByRole('button', {name: method === 'cancel' ? 'Cancelar' : 'Guardar nombre', exact: true}).click();
      await expect(rename(page)).toBeHidden(); await expect(title(page)).toHaveValue('Tarea 1');
      await expect(page.locator('[data-focus-key="rename-bed-1"]')).toBeFocused();
      expect(await graph(page)).toEqual(before); await expect(page.locator('.metadata-context')).toHaveText(longName);
      // UI-36 preparation only: 5A must additionally verify announcement behavior.
      await probePreservedFailure(page, `Fixture conservado por ${method}`);
    }
  });

  test('dirty rename preserves nodes and raw text, discard restores, invalid and failed Save cannot revive an old intention', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await workspace(page); const editor = await body(page).elementHandle();
    await body(page).fill('Borrador protegido');
    const date = await timeField(page, /^Fecha/, 'Día / mes / año'), dateNode = await date.elementHandle();
    await date.fill('31/02/2026'); await closeTime(page); await openRename(page);
    await expect(rename(page)).toBeHidden(); await guard(page).getByRole('button', {name: 'Volver', exact: true}).click();
    await expect(guard(page)).toBeHidden(); await expect(body(page)).toHaveValue('Borrador protegido'); await expect(date).toHaveValue('31/02/2026');
    expect(await body(page).evaluate((node, prior) => node === prior, editor)).toBe(true);
    expect(await date.evaluate((node, prior) => node === prior, dateNode)).toBe(true);
    await openRename(page); await guard(page).getByRole('button', {name: 'Descartar cambios', exact: true}).click();
    await expect(rename(page)).toBeVisible();
    await expect(rename(page).getByRole('textbox', {name: 'Nombre de la lista', exact: true})).toHaveValue('Lista 1');
    // Under a modal, use the stable DOM fields rather than hidden role names.
    await expect(page.locator('#body')).toHaveValue(''); await expect(page.locator('#date')).toHaveValue('07/11/2026');
    expect(await page.locator('#body').evaluate((node, prior) => node === prior, editor)).toBe(true);
    expect(await page.locator('#date').evaluate((node, prior) => node === prior, dateNode)).toBe(true);
    await rename(page).getByRole('button', {name: 'Cancelar', exact: true}).click(); await expect(rename(page)).toBeHidden();
    await expect(title(page)).toHaveValue('Tarea 1'); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled();
    const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('abc');
    await page.getByRole('button', {name: /^Estimación/}).click(); await closeTime(page);
    await body(page).fill('No perder al validar'); await openRename(page);
    await guard(page).getByRole('button', {name: 'Guardar y continuar', exact: true}).click();
    await expect(guard(page)).toBeHidden(); await expect(rename(page)).toBeHidden();
    await expect(modal(page, 'Tiempo')).toBeVisible(); await expect(page.getByRole('button', {name: /^Estimación/})).toHaveAttribute('aria-expanded', 'true');
    await expect(estimate).toHaveValue('abc'); await associatedError(estimate, 'Estimación: usa minutos enteros entre 0 y 1440.');
    await expect(page.locator('#body')).toHaveValue('No perder al validar'); await closeTime(page);
    await select(page, 'Revisar insumos'); await guard(page).getByRole('button', {name: 'Descartar cambios', exact: true}).click();
    await expect(title(page)).toHaveValue('Revisar insumos'); await expect(guard(page)).toBeHidden(); await expect(rename(page)).toBeHidden();
    await select(page, 'Tarea 1');
    for (const failure of ['fallo', 'conflicto'] as const) {
      await body(page).fill(`Conservar ante ${failure}`); await armFailure(page, failure); await openRename(page);
      await guard(page).getByRole('button', {name: 'Guardar y continuar', exact: true}).click();
      await expect(guard(page)).toBeHidden(); await expect(rename(page)).toBeHidden();
      await expect(page.locator('#save-error')).toContainText(failure === 'fallo' ? 'Fallo simulado' : 'Conflicto simulado');
      await expect(body(page)).toHaveValue(`Conservar ante ${failure}`);
    }
    await body(page).fill('Guardado antes de renombrar'); await openRename(page);
    await guard(page).getByRole('button', {name: 'Guardar y continuar', exact: true}).click();
    await expect(rename(page)).toBeVisible(); await expect(page.locator('#body')).toHaveValue('Guardado antes de renombrar');
    await expect(rename(page).getByRole('textbox', {name: 'Nombre de la lista', exact: true})).toHaveValue('Lista 1');
    await expect(page.locator('#save-error')).toBeEmpty();
    await rename(page).getByRole('button', {name: 'Cancelar', exact: true}).click(); await expect(rename(page)).toBeHidden();
    await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled();
    await select(page, 'Revisar insumos'); await expect(guard(page)).toBeHidden();
    await select(page, 'Tarea 1'); await expect(body(page)).toHaveValue('Guardado antes de renombrar');
  });

  test('close conflict retries in place; an empty new shift leaves the old owner readonly and quick notes global', async ({page}) => {
    await select(page, 'Notas rápidas');
    await page.getByRole('textbox', {name: 'Texto de la nota', exact: true}).fill('Nota global anterior'); await save(page);
    await workspace(page); const before = await graph(page);
    await armFailure(page, 'conflicto'); await openClose(page);
    const dialog = closeDialog(page), original = await dialog.elementHandle(), confirm = dialog.getByRole('button', {name: 'Cerrar y archivar', exact: true});
    await expect(dialog).toContainText('4 tareas pendientes'); await expect(dialog).toContainText('No se completarán ni pasarán al siguiente turno.');
    await expect(dialog).not.toContainText(/cancelar[áa]n? (los )?avisos/i); await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('El turno sigue abierto');
    await expect(dialog.getByRole('alert')).toContainText('Cerrar y archivar');
    await expect(dialog.getByRole('alert')).not.toContainText(/guardar|borrador/i); await expect(confirm).toBeEnabled();
    expect(await dialog.evaluate((node, prior) => node === prior, original)).toBe(true); expect(await graph(page)).toEqual(before);
    await confirm.click(); await expect(dialog).toBeHidden();
    await expect(page.locator('.home-summary p')).toHaveText('No hay un turno abierto.');
    await expect(page.locator('.home-summary').getByRole('button', {name: 'Iniciar turno', exact: true})).toBeVisible();
    await expect(title(page)).toHaveCount(0); await expect(page.locator('[data-focus-key="close-shift-toolbar"]')).toHaveCount(0);
    await select(page, 'Agregar nota rápida'); await createName(page, 'Nueva nota rápida', 'Título de nota nueva', 'Nota sin turno');
    await expect(page.getByRole('textbox', {name: 'Título de nota', exact: true})).toHaveValue('Nota sin turno');
    await expect(page.locator('.note-caption')).toHaveText('Una nota independiente de tus turnos y listas.');
    await page.getByRole('textbox', {name: 'Texto de la nota', exact: true}).fill('Permanece global'); await save(page);
    await select(page, 'Iniciar turno'); await createName(page, 'Iniciar turno', 'Nombre del turno', 'Turno siguiente', 'Iniciar');
    await expect(page.getByRole('heading', {name: 'Turno siguiente', exact: true})).toBeVisible();
    await expect(page.locator('.navigation .bed-group,.navigation .task-row')).toHaveCount(0);
    const empty = await agenda(page);
    await expect(empty.locator('.agenda-count')).toHaveText('0 tareas · 0 pendientes');
    await expect(empty).toContainText('Agrega una tarea. Aparecerá aquí aunque no tenga fecha.');
    await expect(empty.getByRole('button', {name: 'Agregar tarea', exact: true})).toBeEnabled();
    await expect(empty.locator('.agenda-task,[role="grid"],table,input[type="date"]')).toHaveCount(0);
    await page.getByRole('tab', {name: 'Tarea', exact: true}).click();
    await expect(page.getByRole('tabpanel', {name: 'Tarea', exact: true})).toContainText('Selecciona una tarea');
    await openArchive(page); expect(await graph(page)).toEqual(before); await expandBed(page, 'Lista 2');
    await select(page, 'Revisar material · Prioridad Alta');
    await expect(title(page)).toHaveValue('Revisar material'); await expect(title(page)).toHaveAttribute('readonly'); await expect(body(page)).toHaveAttribute('readonly');
    await expect(page.getByRole('checkbox', {name: 'Tarea completada', exact: true})).toBeDisabled();
    await expect(nav(page).getByRole('checkbox', {name: 'Completar Revisar material', exact: true})).toBeDisabled();
    await expect(nav(page).getByRole('button', {name: 'Revisar material · Prioridad Alta', exact: true}).locator('.priority-badge')).toHaveText('Prioridad Alta');
    await expect(page.locator('.navigation [data-focus-key^="rename-"],.navigation [data-focus-key^="create-task-bed-"],.navigation [data-focus-key="create-bed"]')).toHaveCount(0);
    await expect(page.locator('.editor .save-actions,.editor [data-focus-key="create-task-inline"]')).toHaveCount(0);
    await expect(page.getByLabel('Motivo', {exact: true})).toHaveAttribute('readonly'); await expect(page.getByRole('combobox', {name: 'Prioridad', exact: true})).toBeDisabled();
    await timeField(page, /^Fecha/, 'Día / mes / año');
    for (const id of ['date', 'time', 'estimate', 'performed', 'duration']) await expect(page.locator(`#${id}`)).toBeDisabled();
    const archived = await agenda(page); await expect(archived.locator('.agenda-count')).toHaveText('4 tareas · 4 pendientes');
    await expect(archived.getByRole('button', {name: '14:00 · Revisar material · Prioridad Alta · Lista 2', exact: true})).toBeVisible();
    await expect(archived.locator('.agenda-caption')).toHaveText('Turno de día');
    await select(page, 'Agregar tarea'); await createName(page, 'Agregar tarea', 'Título de tarea nueva', 'Tarea del turno activo');
    await expect(title(page)).toHaveValue('Tarea del turno activo'); await expect(body(page)).not.toHaveAttribute('readonly');
    await expect(page.locator('.metadata-context')).toHaveText('Sin lista'); await expect(page.locator('.navigation .shift-context strong')).toHaveText('Turno siguiente');
    expect((await graph(page)).map((item) => ({title: item.title, group: item.group}))).toEqual([{title: 'Tarea del turno activo', group: null}]);
    await select(page, 'Notas rápidas'); await expect(page.getByRole('textbox', {name: 'Texto de la nota', exact: true})).toHaveValue('Nota global anterior');
    await select(page, 'Nota sin turno'); await expect(page.getByRole('textbox', {name: 'Texto de la nota', exact: true})).toHaveValue('Permanece global');
    await expect(page.getByRole('textbox', {name: 'Texto de la nota', exact: true})).not.toHaveAttribute('readonly');
    await openArchive(page); expect(await graph(page)).toEqual(before);
  });

  test('one pending task uses singular copy; Volver preserves it and closing from Home adds no route', async ({page}) => {
    await observeHistory(page); await page.reload(); await workspace(page);
    for (const name of ['Tarea 1', 'Revisar insumos', 'Preparar educación']) {
      const check = nav(page).getByRole('checkbox', {name: `Completar ${name}`, exact: true}); await check.check();
      await expect(nav(page).getByRole('checkbox', {name: `Reabrir ${name}`, exact: true})).toBeChecked();
      await expect(nav(page).getByRole('checkbox', {name: `Reabrir ${name}`, exact: true})).toBeEnabled();
    }
    await expect((await agenda(page)).locator('.agenda-count')).toHaveText('4 tareas · 1 pendiente');
    await select(page, 'Inicio'); await expect(page.locator('.home-summary p')).toHaveText('Turno de día · 1 pendiente');
    const history = await historySnapshot(page);
    await openClose(page); await expect(closeDialog(page).locator('strong')).toHaveText('1 tarea pendiente');
    await expect(closeDialog(page)).toContainText('se conservará en el archivo.');
    await closeDialog(page).getByRole('button', {name: 'Volver', exact: true}).click(); await expect(closeDialog(page)).toBeHidden();
    await expect(page.locator('.home-summary p')).toHaveText('Turno de día · 1 pendiente'); expect(await historySnapshot(page)).toEqual(history);
    await closeShift(page); await expect(page.locator('.home-summary').getByRole('button', {name: 'Iniciar turno', exact: true})).toBeFocused();
    expect(await historySnapshot(page)).toEqual(history);
    await openArchive(page); await expect((await agenda(page)).locator('.agenda-count')).toHaveText('4 tareas · 1 pendiente');
    await expandBed(page, 'Lista 2'); await expect(nav(page).getByRole('checkbox', {name: 'Completar Revisar material', exact: true})).not.toBeChecked();
  });
});

async function observeHistory(page: Page) {
  await page.addInitScript(() => {
    const calls: string[] = []; Object.defineProperty(window, '__turno4BHistoryCalls', {value: calls});
    const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<History['pushState']>) => {calls.push('push'); return push(...args);};
    history.replaceState = (...args: Parameters<History['replaceState']>) => {calls.push('replace'); return replace(...args);};
  });
}
async function historySnapshot(page: Page) {
  return page.evaluate(() => ({state: history.state, length: history.length, url: location.href, calls: Reflect.get(window, '__turno4BHistoryCalls') as string[]}));
}
async function expectIndex(page: Page, index: number) {await expect.poll(async () => (await historySnapshot(page)).state?.idx).toBe(index);}

test('UI-34 · file · real App with existing finite-delay transport blocks a second rename submit', async ({page}, info) => {
  // Reuse the installed harness unchanged. This is not the normal preview's
  // zero-delay transport, and neither the app nor its clock is instrumented.
  await page.goto(`${pathToFileURL(resolve('dist-layout/layout-harness.html')).href}?fixture=product-delayed`);
  await expect(title(page)).toHaveValue('Tarea 1'); const links = await graph(page);
  await armFailure(page, 'fallo'); await openRename(page);
  const dialog = rename(page), original = await dialog.elementHandle();
  const field = dialog.getByRole('textbox', {name: 'Nombre de la lista', exact: true}), input = await field.elementHandle();
  const submit = dialog.getByRole('button', {name: 'Guardar nombre', exact: true});
  await field.fill('Nombre recuperable una sola vez'); await submit.dblclick();
  await expect(field).toHaveAttribute('readonly'); await expect(submit).toBeDisabled();
  await expect(dialog.getByRole('button', {name: 'Cancelar', exact: true})).toBeDisabled();
  await expect(dialog.getByRole('button', {name: 'Cerrar diálogo', exact: true})).toBeDisabled();
  const pending = await dialog.evaluate((node) => ({
    inputReadonly: node.querySelector('input')?.hasAttribute('readonly'),
    buttons: Array.from(node.querySelectorAll('button')).map((button) => ({name: button.getAttribute('aria-label') || button.textContent, disabled: button.disabled})),
  }));
  await info.attach('existing-delayed-transport-pending', {body: JSON.stringify({fixture: 'product-delayed', delayMs: 1500, pending}, null, 2), contentType: 'application/json'});
  await expect(dialog.getByRole('alert')).toContainText('Fallo simulado'); await expect(submit).toBeEnabled();
  await expect(field).not.toHaveAttribute('readonly'); await expect(field).toHaveValue('Nombre recuperable una sola vez');
  expect(await dialog.evaluate((node, prior) => node === prior, original)).toBe(true);
  expect(await field.evaluate((node, prior) => node === prior, input)).toBe(true);
  await expect(page.locator('[aria-controls="group-bed-1"] span')).toHaveText('Lista 1'); expect(await graph(page)).toEqual(links);
  // The failure fixture is consumed only once. An unintended second persistence
  // would succeed, change the label and dismiss this same modal without a retry.
  await submit.click(); await expect(dialog).toBeHidden();
  await expect(page.locator('[aria-controls="group-bed-1"] span')).toHaveText('Nombre recuperable una sola vez');
  await expect(title(page)).toHaveValue('Tarea 1'); expect(await graph(page)).toEqual(links);
});

for (const theme of ['light', 'dark'] as const) test(`CONFLICT-COLOR · file · ${theme} · close conflict keeps the source error color`, async ({page}, info) => {
  await load(page); await appearance(page, theme); await workspace(page); await armFailure(page, 'conflicto'); await openClose(page);
  const dialog = closeDialog(page), original = await dialog.elementHandle(), confirm = dialog.getByRole('button', {name: 'Cerrar y archivar', exact: true});
  await confirm.click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('El turno sigue abierto'); await expect(alert).toContainText('Cerrar y archivar');
  await expect(alert).not.toContainText(/guardar|borrador/i); await expect(confirm).toBeEnabled();
  expect(await dialog.evaluate((node, prior) => node === prior, original)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  const colors = await alert.evaluate((node) => {
    const originalToken = getComputedStyle(document.documentElement).getPropertyValue('--error').trim();
    // A detached native canvas resolves any browser-supported CSS color, including
    // named colors emitted by minification. No hex-only parser or app mutation.
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Native color resolver unavailable');
    const supported = CSS.supports('color', originalToken);
    context.fillStyle = originalToken; context.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
    const resolved = alpha === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha! / 255})`;
    return {utc: new Date().toISOString(), originalToken, supported, resolved, actual: getComputedStyle(node).color, text: node.textContent};
  });
  await info.attach(`conflict-color-${theme}-raw`, {body: JSON.stringify(colors, null, 2), contentType: 'application/json'});
  await info.attach(`conflict-color-${theme}-original`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
  expect(colors.supported).toBe(true); expect(colors.actual).toBe(colors.resolved);
  await confirm.click(); await expect(dialog).toBeHidden(); await expect(page.locator('.home-summary p')).toHaveText('No hay un turno abierto.');
});

for (const direction of [-1, 1]) test(`HISTORY-06 · file · top layer consumes traversal ${direction} and keeps the complete Forward branch`, async ({page}, info) => {
  await observeHistory(page); await load(page); await workspace(page); await select(page, 'Revisar insumos');
  await page.evaluate(() => history.back()); await expectIndex(page, 1); await expect(title(page)).toHaveValue('Tarea 1');
  const before = await historySnapshot(page), links = await graph(page);
  await nav(page).getByRole('button', {name: 'Más opciones', exact: true}).click(); await expect(page.locator('#more-options')).toBeVisible();
  await page.evaluate((delta) => history.go(delta), direction);
  await expect(page.locator('#more-options')).toBeHidden(); await expectIndex(page, 1); await expect(title(page)).toHaveValue('Tarea 1');
  expect(await historySnapshot(page)).toEqual(before);
  await openRename(page); await rename(page).getByRole('textbox', {name: 'Nombre de la lista', exact: true}).fill('No confirmado por historial');
  await page.evaluate((delta) => history.go(delta), direction);
  await expect(rename(page)).toBeHidden(); await expectIndex(page, 1); await expect(title(page)).toHaveValue('Tarea 1');
  expect(await historySnapshot(page)).toEqual(before); expect(await graph(page)).toEqual(links);
  await expect(page.locator('[aria-controls="group-bed-1"] span')).toHaveText('Lista 1');
  await page.evaluate((delta) => history.go(delta), direction); await expectIndex(page, 1 + direction);
  if (direction < 0) {
    await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
    await page.evaluate(() => history.forward()); await expectIndex(page, 1); await expect(title(page)).toHaveValue('Tarea 1');
  }
  if (direction < 0) await page.evaluate(() => history.forward());
  await expectIndex(page, 2); await expect(title(page)).toHaveValue('Revisar insumos');
  await page.evaluate(() => history.back()); await expectIndex(page, 1); await expect(title(page)).toHaveValue('Tarea 1');
  const after = await historySnapshot(page);
  await info.attach('history-before-after', {body: JSON.stringify({direction, before, after}, null, 2), contentType: 'application/json'});
  expect(after).toEqual(before);
});

// Preserve raw measurements and original PNG before making any geometric claim.
async function captureGeometry(page: Page, info: TestInfo, state: string, selectors: string[]) {
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate((queries) => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height};
    };
    const measured = queries.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
      const css = getComputedStyle(element);
      return {selector, tag: element.tagName, id: element.id, focusKey: element.dataset.focusKey ?? null,
        visible: element.getClientRects().length > 0 && css.visibility !== 'hidden', box: box(element),
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
        focused: document.activeElement === element, focusVisible: element.matches(':focus-visible'),
        color: css.color, fontSize: css.fontSize, minHeight: css.minHeight, minWidth: css.minWidth, maxWidth: css.maxWidth, flexShrink: css.flexShrink,
        outlineWidth: css.outlineWidth, outlineOffset: css.outlineOffset, outlineStyle: css.outlineStyle,
        overflowX: css.overflowX, overflowY: css.overflowY, overflowWrap: css.overflowWrap, gridColumns: css.gridTemplateColumns,
        padding: {top: parseFloat(css.paddingTop), right: parseFloat(css.paddingRight), bottom: parseFloat(css.paddingBottom), left: parseFloat(css.paddingLeft)},
        margin: {left: css.marginLeft, right: css.marginRight},
      };
    }));
    // Independent existing declarations resolve env(safe-area-inset-*). Do not
    // derive the oracle by subtracting 12 from the drawer under test itself.
    const shell = document.querySelector('.app-shell'), toolbar = document.querySelector('.toolbar'), editor = document.querySelector('.editor');
    const safeAreaFromShellPadding = innerWidth < 700 && shell && toolbar && editor ? {
      top: parseFloat(getComputedStyle(toolbar).paddingTop) - 8,
      right: parseFloat(getComputedStyle(shell).paddingRight),
      bottom: parseFloat(getComputedStyle(editor).paddingBottom) - 16,
      left: parseFloat(getComputedStyle(shell).paddingLeft),
    } : null;
    const declaredFormMaxWidths: string[] = [];
    const visit = (rules: CSSRuleList) => {for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && rule.selectorText === '.editor form' && rule.style.maxWidth) declaredFormMaxWidths.push(rule.style.maxWidth);
      if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
    }};
    for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules);
    return {utc: new Date().toISOString(), url: location.href, theme: document.documentElement.dataset.theme,
      viewport: {width: innerWidth, height: innerHeight, devicePixelRatio, scrollX, scrollY,
        visual: visualViewport ? {width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop} : null},
      document: {scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth},
      safeAreaFromShellPadding, declaredFormMaxWidths, measured};
  }, selectors);
  await info.attach(`${state}-raw-geometry`, {body: JSON.stringify(data, null, 2), contentType: 'application/json'});
  await info.attach(`${state}-original`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
  return data;
}
type Geometry = Awaited<ReturnType<typeof captureGeometry>>;
type Box = Geometry['measured'][number]['box'];
function item(data: Geometry, selector: string) {
  const found = data.measured.filter((entry) => entry.selector === selector && entry.visible);
  expect(found, selector).toHaveLength(1); return found[0]!;
}
function contained(inner: Box, outer: Pick<Box, 'left' | 'right' | 'top' | 'bottom'>) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left); expect(inner.right).toBeLessThanOrEqual(outer.right);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top); expect(inner.bottom).toBeLessThanOrEqual(outer.bottom);
}
function viewportBounds(data: Geometry) {return {left: 0, top: 0, right: data.viewport.width, bottom: data.viewport.height};}
function focusEnvelope(entry: Geometry['measured'][number]) {
  expect(entry.focused).toBe(true); expect(entry.focusVisible).toBe(true);
  expect(entry.outlineWidth).toBe('2px'); expect(entry.outlineOffset).toBe('2px'); expect(entry.outlineStyle).toBe('solid');
  const extent = parseFloat(entry.outlineWidth) + parseFloat(entry.outlineOffset);
  return {...entry.box, left: entry.box.left - extent, right: entry.box.right + extent, top: entry.box.top - extent, bottom: entry.box.bottom + extent};
}
function modalGeometry(data: Geometry, withInput: boolean) {
  const dialog = item(data, '.domain-dialog'); contained(dialog.box, viewportBounds(data));
  expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  for (const button of data.measured.filter((entry) => entry.selector === '.domain-dialog button' && entry.visible)) {
    expect(button.box.height).toBeGreaterThanOrEqual(44); contained(button.box, dialog.box);
  }
  const focused = data.measured.find((entry) => entry.focused && entry.visible);
  expect(focused).toBeDefined(); contained(focusEnvelope(focused!), dialog.box); contained(focusEnvelope(focused!), viewportBounds(data));
  if (withInput) {
    const input = item(data, '#domain-name'); expect(input.box.height).toBeGreaterThanOrEqual(44); contained(input.box, dialog.box);
    if (data.viewport.width < 700) expect(input.fontSize).toBe('16px');
  }
  expect(data.document.scrollWidth).toBeLessThanOrEqual(data.document.clientWidth);
}

for (const width of [320, 375, 390, 430, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`4B emulated geometry · file · ${width}px ${theme} · rename, close and readonly archive`, async ({page}, info) => {
    await page.setViewportSize({width, height: 844}); await load(page); await appearance(page, theme); await workspace(page);
    await body(page).fill('Texto conservado tras fallo y archivo'); await armFailure(page, 'fallo');
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.locator('#save-error')).toContainText('Fallo simulado');
    await expect(body(page)).toHaveValue('Texto conservado tras fallo y archivo');
    await captureGeometry(page, info, 'failed-save-before-rename', ['.editor', '#editor-form', '#body', '#save-error']);
    await save(page); await openRename(page); await expect(rename(page)).toBeVisible();
    const field = rename(page).getByRole('textbox', {name: 'Nombre de la lista', exact: true});
    await field.press('Home');
    modalGeometry(await captureGeometry(page, info, 'rename-prefill', ['.domain-dialog', '#domain-name', '.domain-dialog button']), true);
    await field.fill('   '); await rename(page).getByRole('button', {name: 'Guardar nombre', exact: true}).click();
    await associatedError(field, 'Nombre de la lista: escribe de 1 a 300 caracteres.');
    modalGeometry(await captureGeometry(page, info, 'rename-invalid', ['.domain-dialog', '#domain-name', '#domain-name-error', '.domain-dialog button']), true);
    await field.fill(longName); await field.press('End');
    modalGeometry(await captureGeometry(page, info, 'rename-long', ['.domain-dialog', '#domain-name', '.domain-dialog button']), true);
    await rename(page).getByRole('button', {name: 'Guardar nombre', exact: true}).click(); await expect(rename(page)).toBeHidden();
    await openNav(page); await expect(nav(page).locator('.task-tree')).toHaveCount(1);
    await expect(nav(page).getByRole('button', {name: 'Archivo de turnos anteriores', exact: true})).toBeVisible();
    await expect(nav(page).getByRole('button', {name: 'Más opciones', exact: true})).toBeVisible();
    await expect(nav(page).getByRole('button', {name: 'Más opciones', exact: true})).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#more-options')).toBeHidden();
    await nav(page).getByRole('button', {name: 'Más opciones', exact: true}).click();
    await expect(page.locator('#more-options')).toBeVisible();
    await expect(page.locator('#more-options').getByText('Datos sintéticos · Se reinician al recargar', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Demo local: datos sintéticos', exact: true})).toBeVisible();
    // Observational only: retain native focus transitions and tab-index state
    // without repairing the portal, moving focus or changing any DOM attribute.
    const focusObserver = await page.evaluateHandle(() => {
      const describe = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return target === null ? null : {tag: 'non-element'};
        return {tag: target.tagName, id: target.id, key: target.getAttribute('data-focus-key'), role: target.getAttribute('role'),
          ariaLabel: target.getAttribute('aria-label'), text: target.textContent,
          tabIndex: target instanceof HTMLElement ? target.tabIndex : null, tabIndexAttribute: target.getAttribute('tabindex'),
          dataTabindex: target.getAttribute('data-tabindex'), inertAncestor: target.closest('[inert]')?.id ?? null};
      };
      const read = () => ({at: performance.now(), activeElement: describe(document.activeElement),
        navigation: Array.from(document.querySelectorAll('#navigation-panel button,#navigation-panel input,#navigation-panel select,#navigation-panel textarea,#navigation-panel [tabindex]')).map(describe)});
      const snapshots: ({step: string} & ReturnType<typeof read>)[] = [];
      const events: ({type: string; target: ReturnType<typeof describe>; relatedTarget: ReturnType<typeof describe>} & ReturnType<typeof read>)[] = [];
      const onFocus = (event: FocusEvent) => events.push({type: event.type, target: describe(event.target), relatedTarget: describe(event.relatedTarget), ...read()});
      document.addEventListener('focusin', onFocus, true); document.addEventListener('focusout', onFocus, true);
      const snapshot = (step: string) => {snapshots.push({step, ...read()});};
      snapshot('before-more-escape');
      return {snapshot, stop() {
        document.removeEventListener('focusin', onFocus, true); document.removeEventListener('focusout', onFocus, true);
        return {utc: new Date().toISOString(), snapshots, events};
      }};
    });
    try {
      await page.keyboard.press('Escape');
      await focusObserver.evaluate((observer) => observer.snapshot('after-more-escape'));
      await expect(page.locator('#more-options')).toBeHidden();
      await expect(nav(page).locator('[data-focus-key^="close-shift"]')).toHaveCount(0);
      expect(await nav(page).evaluate((node) => {
        const tree = node.querySelector('.task-tree'), notes = node.querySelector('.section-title');
        return !!tree && !!notes && !!(tree.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING);
      })).toBe(true);
      await expect(page.locator('[data-focus-key="complete-task-1"]').locator('..')).toHaveJSProperty('tagName', 'LABEL');
      await expect(page.locator('[aria-controls="group-bed-1"] span')).toHaveText(longName);
      const side = nav(page).getByRole('button', {name: `Editar nombre de ${longName}`, exact: true});
      await side.scrollIntoViewIfNeeded();
      await focusObserver.evaluate((observer) => observer.snapshot('before-side-focus'));
      await side.focus();
      await focusObserver.evaluate((observer) => {observer.snapshot('after-side-focus'); observer.snapshot('before-tab');});
      await side.press('Tab');
      await focusObserver.evaluate((observer) => observer.snapshot('after-tab'));
    } finally {
      const observedFocus = await focusObserver.evaluate((observer) => observer.stop()); await focusObserver.dispose();
      await info.attach('more-escape-side-tab-focus-raw', {body: JSON.stringify(observedFocus, null, 2), contentType: 'application/json'});
    }
    await expect(nav(page).getByRole('button', {name: `Agregar tarea a ${longName}`, exact: true})).toBeFocused();
    const navigation = await captureGeometry(page, info, 'long-navigation', ['#navigation-panel', '.nav-scroll', '.nav-footer', '.footer-actions', '.footer-actions > button', '.bed-line', '.bed-line > .icon-button', '[data-focus-key="create-task-bed-bed-1"]']);
    const panel = item(navigation, '#navigation-panel'), scroll = item(navigation, '.nav-scroll'), footer = item(navigation, '.nav-footer');
    contained(panel.box, viewportBounds(navigation)); contained(footer.box, panel.box); contained(scroll.box, panel.box);
    expect(scroll.overflowY).toBe('auto'); expect(scroll.minHeight).toBe('0px'); expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    expect(scroll.box.bottom).toBeLessThanOrEqual(footer.box.top); expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
    const footButtons = navigation.measured.filter((entry) => entry.selector === '.footer-actions > button'); expect(footButtons).toHaveLength(2);
    expect(item(navigation, '.footer-actions').gridColumns.split(' ')).toHaveLength(2);
    for (const button of footButtons) {expect(button.box.height).toBeGreaterThanOrEqual(44); contained(button.box, footer.box);}
    for (const button of navigation.measured.filter((entry) => entry.selector === '.bed-line > .icon-button' && entry.visible)) {
      expect(button.flexShrink).toBe('0'); expect(button.box.width).toBeGreaterThanOrEqual(44); expect(button.box.height).toBeGreaterThanOrEqual(44);
      expect(button.box.left).toBeGreaterThanOrEqual(scroll.box.left); expect(button.box.right).toBeLessThanOrEqual(scroll.box.right);
    }
    const addTaskEnvelope = focusEnvelope(item(navigation, '[data-focus-key="create-task-bed-bed-1"]'));
    expect.soft(addTaskEnvelope.left).toBeGreaterThanOrEqual(scroll.box.left); expect.soft(addTaskEnvelope.right).toBeLessThanOrEqual(scroll.box.right);
    expect.soft(addTaskEnvelope.top).toBeGreaterThanOrEqual(scroll.box.top); expect.soft(addTaskEnvelope.bottom).toBeLessThanOrEqual(scroll.box.bottom);
    if (width < 700) {
      expect(navigation.safeAreaFromShellPadding).not.toBeNull();
      for (const edge of ['top', 'right', 'bottom', 'left'] as const) expect(panel.padding[edge]).toBe(12 + navigation.safeAreaFromShellPadding![edge]);
      await page.keyboard.press('Escape'); await expect(modal(page, 'Navegación')).toBeHidden();
      await expect(page.getByRole('button', {name: 'Abrir navegación', exact: true})).toBeFocused();
      await openNav(page); await page.locator('#navigation-panel').getByRole('button', {name: 'Cerrar turno', exact: true}).click();
    } else await openClose(page);
    await expect(closeDialog(page)).toBeVisible(); await expect(closeDialog(page)).toContainText('4 tareas pendientes');
    await closeDialog(page).getByRole('button', {name: 'Volver', exact: true}).press('Tab');
    modalGeometry(await captureGeometry(page, info, 'close-confirmation', ['.domain-dialog', '.domain-dialog button']), false);
    await closeDialog(page).getByRole('button', {name: 'Volver', exact: true}).click(); await expect(closeDialog(page)).toBeHidden();
    await expect(body(page)).toHaveValue('Texto conservado tras fallo y archivo');
    await armFailure(page, 'fallo'); await openClose(page);
    await closeDialog(page).getByRole('button', {name: 'Cerrar y archivar', exact: true}).click();
    await expect(closeDialog(page).getByRole('alert')).toContainText('Fallo simulado');
    await closeDialog(page).getByRole('button', {name: 'Cerrar y archivar', exact: true}).press('Shift+Tab');
    modalGeometry(await captureGeometry(page, info, 'close-error', ['.domain-dialog', '.domain-dialog button', '.domain-dialog [role="alert"]']), false);
    await closeDialog(page).getByRole('button', {name: 'Cerrar y archivar', exact: true}).click(); await expect(closeDialog(page)).toBeHidden();
    await openArchive(page); await expect(body(page)).toHaveValue('Texto conservado tras fallo y archivo');
    await expect(body(page)).toHaveAttribute('readonly'); await expect(page.getByRole('checkbox', {name: 'Tarea completada', exact: true})).toBeDisabled();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const reason = page.getByLabel('Motivo', {exact: true}); await reason.press('Home');
    const archived = await captureGeometry(page, info, 'readonly-archive', ['.workspace', '.editor', '#editor-form', '.archive-notice', '.metadata', '#reason']);
    const form = item(archived, '#editor-form'), editor = item(archived, '.editor'), notice = item(archived, '.archive-notice'), metadata = item(archived, '.metadata');
    expect(archived.declaredFormMaxWidths).toContain('76ch'); expect(form.box.width).toBeLessThanOrEqual(parseFloat(form.maxWidth));
    expect(form.margin.left).toBe(form.margin.right); contained(form.box, editor.box); contained(notice.box, form.box);
    expect(notice.box.width).toBe(form.box.width); expect(notice.scrollWidth).toBeLessThanOrEqual(notice.clientWidth);
    expect(archived.document.scrollWidth).toBeLessThanOrEqual(archived.document.clientWidth);
    contained(focusEnvelope(item(archived, '#reason')), metadata.box); contained(focusEnvelope(item(archived, '#reason')), viewportBounds(archived));
    if (width < 700) {expect(metadata.padding.left).toBe(12); expect(metadata.padding.right).toBe(12); expect(item(archived, '#reason').fontSize).toBe('16px');}
    // A second real, empty shift supplies a long shift/archive label without a
    // synthetic snapshot or a hidden fixture in the normal product entry.
    const shiftName = 'Turno <turno> · ' + 'Revisión'.repeat(30);
    await select(page, 'Iniciar turno'); await createName(page, 'Iniciar turno', 'Nombre del turno', shiftName, 'Iniciar');
    await expect(page.getByRole('heading', {name: shiftName, exact: true})).toBeVisible();
    await openNav(page); await expect(nav(page).locator('.shift-context strong')).toHaveText(shiftName);
    const shift = await captureGeometry(page, info, 'long-shift-context', ['#navigation-panel', '.nav-scroll', '.shift-context', '.shift-context strong']);
    const context = item(shift, '.shift-context'), label = item(shift, '.shift-context strong');
    expect.soft(label.overflowWrap, 'shift context inherits source break-word').toBe('break-word');
    expect.soft(label.scrollWidth, 'unbroken shift text fits its own column').toBeLessThanOrEqual(label.clientWidth);
    expect.soft(label.box.left).toBeGreaterThanOrEqual(context.box.left); expect.soft(label.box.right).toBeLessThanOrEqual(context.box.right);
    expect.soft(context.box.left).toBeGreaterThanOrEqual(item(shift, '#navigation-panel').box.left);
    expect.soft(context.box.right).toBeLessThanOrEqual(item(shift, '#navigation-panel').box.right);
    expect.soft(item(shift, '.nav-scroll').scrollWidth, 'shift does not create horizontal navigation scroll').toBeLessThanOrEqual(item(shift, '.nav-scroll').clientWidth);
    // Exercise a real global note too. Read its text with a Range so the oracle
    // survives a semantic wrapper; it does not require the old v5 span markup.
    const noteName = 'Nota global · ' + 'Preparación'.repeat(24);
    await select(page, 'Agregar nota rápida'); await createName(page, 'Nueva nota rápida', 'Título de nota nueva', noteName);
    await expect(page.getByRole('textbox', {name: 'Título de nota', exact: true})).toHaveValue(noteName);
    await openNav(page);
    const note = nav(page).getByRole('button', {name: noteName, exact: true}); await note.scrollIntoViewIfNeeded();
    const noteKey = await note.getAttribute('data-focus-key'); expect(noteKey).toMatch(/^select-note-/);
    const noteSelector = `[data-focus-key="${noteKey}"]`;
    const noteText = await note.evaluate((button) => {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      const parts: {text: string; parentTag: string; overflowWrap: string; rects: {left: number; right: number; top: number; bottom: number; width: number; height: number}[]}[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || !node.parentElement || node.parentElement.closest('svg')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        parts.push({text: node.textContent, parentTag: node.parentElement.tagName, overflowWrap: getComputedStyle(node.parentElement).overflowWrap,
          rects: Array.from(range.getClientRects()).map((rect) => ({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height}))});
      }
      return {text: parts.map((part) => part.text).join(''), parts};
    });
    await info.attach('long-note-text-ranges-raw', {body: JSON.stringify(noteText, null, 2), contentType: 'application/json'});
    const noteLayout = await captureGeometry(page, info, 'long-global-note', ['#navigation-panel', '.nav-scroll', noteSelector, `${noteSelector} svg`]);
    const noteBox = item(noteLayout, noteSelector), icon = item(noteLayout, `${noteSelector} svg`), noteScroll = item(noteLayout, '.nav-scroll');
    expect.soft(noteText.text, 'full global note title remains literal').toBe(noteName);
    expect.soft(noteBox.box.height, 'note remains a 44px target').toBeGreaterThanOrEqual(44);
    expect.soft(noteBox.box.width).toBeGreaterThanOrEqual(44);
    expect.soft(noteBox.box.left).toBeGreaterThanOrEqual(noteScroll.box.left); expect.soft(noteBox.box.right).toBeLessThanOrEqual(noteScroll.box.right);
    expect.soft(noteBox.scrollWidth, 'unbroken note title fits its control').toBeLessThanOrEqual(noteBox.clientWidth);
    expect.soft(noteScroll.scrollWidth, 'note does not create horizontal navigation scroll').toBeLessThanOrEqual(noteScroll.clientWidth);
    expect.soft(icon.box.width, 'note icon retains its declared 20px viewport').toBe(20); expect.soft(icon.box.height).toBe(20);
    expect.soft(noteText.parts.length).toBeGreaterThan(0);
    for (const part of noteText.parts) {
      expect.soft(part.overflowWrap, 'effective note text parent inherits source break-word').toBe('break-word');
      expect.soft(part.rects.length).toBeGreaterThan(0);
      for (const rect of part.rects) {
        expect.soft(rect.left, 'text line starts after the note icon').toBeGreaterThanOrEqual(icon.box.right);
        expect.soft(rect.right, 'text line stays inside the note control').toBeLessThanOrEqual(noteBox.box.right - noteBox.padding.right);
      }
    }
    await closeNav(page); await closeShift(page); await select(page, 'Archivo de turnos anteriores');
    await expect(page.locator('.archive-link span').filter({hasText: shiftName})).toHaveCount(1);
    await expect(page.locator('turno')).toHaveCount(0);
    const archiveList = await captureGeometry(page, info, 'long-archive-entry', ['.archive-view', '.archive-link', '.archive-link span']);
    const archiveView = item(archiveList, '.archive-view');
    for (const entry of archiveList.measured.filter((entry) => entry.selector === '.archive-link' || entry.selector === '.archive-link span')) {
      contained(entry.box, archiveView.box); expect(entry.scrollWidth).toBeLessThanOrEqual(entry.clientWidth);
      expect(entry.box.left).toBeGreaterThanOrEqual(0); expect(entry.box.right).toBeLessThanOrEqual(width);
    }
    expect(archiveList.document.scrollWidth).toBeLessThanOrEqual(archiveList.document.clientWidth);
  });
}
