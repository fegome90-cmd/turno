// 4A real ProductApp integration. Controlled event/IME tests are labelled explicitly;
// they do not certify a physical IME, assistive technology, iOS or native zoom.
import {test, expect, type Page, type Locator} from '@playwright/test';
import {createServer, type Server} from 'node:http';
import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const artifact = resolve('dist/preview.html');
let server: Server, httpUrl = '';
const runtime = new WeakMap<Page, {errors: string[]; external: string[]}>();
test.beforeAll(async () => {
  const html = await readFile(artifact);
  server = createServer((_request, response) => {response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); response.end(html);});
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing product port');
  httpUrl = `http://127.0.0.1:${address.port}/preview.html`;
});
test.afterAll(async () => {if (server) await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));});
test.afterEach(({page}) => {expect(runtime.get(page)?.errors ?? []).toEqual([]); expect(runtime.get(page)?.external ?? []).toEqual([]);});
const title = (page: Page) => page.getByRole('textbox', {name: 'Título de tarea'});
const body = (page: Page) => page.getByRole('textbox', {name: 'Notas de la tarea'});
const dialog = (page: Page) => page.getByRole('dialog', {name: 'Hay cambios sin guardar'});
const nav = (page: Page) => page.getByRole('navigation', {name: 'Principal'});
async function openNav(page: Page) {
  const width = await page.evaluate(() => window.innerWidth);
  await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode', width < 700 ? 'drawer' : 'column');
  if (width >= 700) {await expect(nav(page)).toBeVisible(); return;}
  const drawer = page.getByRole('dialog', {name: 'Navegación', exact: true}), disclosure = page.locator('[data-focus-key="open-nav"]');
  // A docked panel may still be visibly exiting after its disclosure is already closed.
  // aria-expanded is the current overlay intention, not the animation's visibility.
  if (await disclosure.getAttribute('aria-expanded') === 'true') {await expect(drawer).toBeVisible(); return;}
  await expect(drawer).toBeHidden(); const trigger = page.getByRole('button', {name: 'Abrir navegación'}); await expect(trigger).toBeVisible(); await trigger.click(); await expect(disclosure).toHaveAttribute('aria-expanded', 'true'); await expect(drawer).toBeVisible();
}
async function workspace(page: Page) {await openNav(page); await nav(page).getByRole('button', {name: 'Ir al turno actual'}).click(); await expect(title(page)).toHaveValue('Tarea 1'); await expect(page.locator('#priority')).toHaveAccessibleName('Prioridad'); await expect(page.getByRole('combobox', {name: 'Prioridad', exact: true})).toBeVisible();}
async function select(page: Page, name: string) {await openNav(page); await nav(page).getByRole('button', {name, exact: true}).click();}
async function save(page: Page) {await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled();}
async function timeField(page: Page, property: RegExp, label: string): Promise<Locator> {
  if (!await page.locator('#time-panel').isVisible()) await page.getByRole('button', {name: 'Mostrar Tiempo'}).click();
  await page.getByRole('tab', {name: 'Tarea', exact: true}).click();
  const trigger = page.getByRole('button', {name: property});
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  return page.getByLabel(label, {exact: true});
}
async function closeTime(page: Page) {const drawer = page.getByRole('dialog', {name: 'Tiempo', exact: true}); if (await drawer.isVisible()) {await page.getByRole('button', {name: 'Cerrar Tiempo', exact: true}).click(); await expect(drawer).toBeHidden();}}
async function failure(page: Page, kind: 'fallo'|'conflicto') {await openNav(page); await page.getByRole('button', {name: 'Más opciones'}).click(); await page.getByRole('button', {name: 'Demo local: datos sintéticos'}).click(); await page.getByRole('button', {name: `Simular ${kind}`}).click();}
async function appearance(page: Page, value: 'light'|'dark'|'system') {await openNav(page); await page.getByRole('button', {name: 'Más opciones'}).click(); await page.getByLabel('Apariencia').selectOption(value); await page.keyboard.press('Escape'); if (await page.getByRole('dialog', {name: 'Navegación', exact: true}).isVisible()) await page.keyboard.press('Escape');}
async function colorToken(page: Page, name: string): Promise<string> {
  return page.evaluate((token) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) throw new Error(`Unexpected declared token ${token}: ${value}`);
    const short = value.slice(1), hex = short.length === 3 ? short.split('').map((part) => part + part).join('') : short;
    return `rgb(${[0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
  }, name);
}
async function stableCapture(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const hover = await page.evaluate(() => matchMedia('(hover:hover)').matches);
  for (const button of await page.locator('.nav-actions .nav-item').all()) {
    const state = await button.evaluate((node: HTMLButtonElement) => ({selected: node.classList.contains('selected'), hovered: node.matches(':hover'), disabled: node.disabled}));
    const name = state.selected ? hover && state.hovered ? '--selected-hover' : '--solid' : hover && state.hovered && !state.disabled ? '--hover' : null;
    await expect(button).toHaveCSS('background-color', name ? await colorToken(page, name) : 'rgba(0, 0, 0, 0)');
  }
  return page.screenshot({fullPage: true});
}

const index = (page: Page) => page.evaluate(() => window.history.state?.idx as number);
async function middle(page: Page) {await workspace(page); await select(page, 'Revisar insumos'); await page.evaluate(() => window.history.back()); await expect(title(page)).toHaveValue('Tarea 1'); await expect.poll(() => index(page)).toBe(1);}

for (const protocol of ['file', 'http'] as const) test.describe(`4A product-integration · ${protocol}`, () => {
  test.beforeEach(async ({page, context}) => {
    await page.setViewportSize({width: 1440, height: 1000});
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status);
    page.on('pageerror', (error) => status.errors.push(error.message));
    page.on('console', (message) => {if (message.type() === 'error') status.errors.push(message.text());});
    const url = protocol === 'file' ? pathToFileURL(artifact).href : httpUrl;
    await context.route('**/*', (route) => {const target = route.request().url(); if (/^(file:|data:|blob:)/.test(target) || target === url) return route.continue(); status.external.push(target); return route.abort();});
    await page.goto(url); await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
  });

  test('HISTORY-01–05 · replace, exact push, stable rerender, native Back/Forward and live title', async ({page}) => {
    await page.addInitScript(() => {
      const observed: string[] = []; Object.defineProperty(window, '__turnoHistoryObserved', {value: observed});
      const replace = history.replaceState.bind(history), push = history.pushState.bind(history);
      history.replaceState = (...args: Parameters<History['replaceState']>) => {observed.push('replace'); return replace(...args);};
      history.pushState = (...args: Parameters<History['pushState']>) => {observed.push('push'); return push(...args);};
    });
    await page.reload(); await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, '__turnoHistoryObserved'))).toEqual(['replace']);
    expect(await index(page)).toBe(0); const length = await page.evaluate(() => history.length), url = page.url();
    await workspace(page); expect(await index(page)).toBe(1); await expect(page).toHaveTitle('Tarea 1 · Turno');
    await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click(); expect(await index(page)).toBe(1);
    await select(page, 'Revisar insumos'); expect(await index(page)).toBe(2);
    await page.evaluate(() => history.back()); await expect(title(page)).toHaveValue('Tarea 1');
    await page.evaluate(() => history.back()); await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible(); await expect(page).toHaveTitle('Inicio · Turno');
    await page.evaluate(() => history.forward()); await expect(title(page)).toHaveValue('Tarea 1');
    await page.evaluate(() => history.forward()); await expect(title(page)).toHaveValue('Revisar insumos');
    expect(await page.evaluate(() => history.length)).toBe(length + 2); expect(page.url()).toBe(url);
    await title(page).fill('Título presente'); await expect(page).toHaveTitle('Título presente · Turno');
  });

  for (const direction of [-1, 1]) test(`HISTORY-08/09 UI-06 · Volver and discard original direction ${direction} retain Forward`, async ({page}) => {
    await middle(page); await body(page).fill('Borrador protegido'); const length = await page.evaluate(() => history.length);
    await page.evaluate((delta) => history.go(delta), direction); await expect(dialog(page)).toBeVisible(); await expect.poll(() => index(page)).toBe(1);
    await dialog(page).getByRole('button', {name: 'Volver'}).click(); await expect(dialog(page)).toBeHidden(); await expect(body(page)).toBeVisible(); await expect(body(page)).toHaveValue('Borrador protegido');
    await page.evaluate((delta) => history.go(delta), direction); await dialog(page).getByRole('button', {name: 'Descartar cambios'}).click();
    if (direction === -1) await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible(); else await expect(title(page)).toHaveValue('Revisar insumos');
    await expect.poll(() => index(page)).toBe(1 + direction); expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('UI-07 INTERFACE-SKILLS-07 · failed/conflicting Save retains draft and retry succeeds', async ({page}) => {
    await workspace(page); await body(page).fill('Conservar error'); await failure(page, 'fallo');
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.locator('#save-error')).toContainText('Fallo simulado');
    await expect(body(page)).toHaveValue('Conservar error'); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeEnabled();
    await failure(page, 'conflicto'); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.locator('#save-error')).toContainText('Conflicto simulado');
    await expect(body(page)).toHaveValue('Conservar error'); await save(page); await select(page, 'Revisar insumos'); await select(page, 'Tarea 1'); await expect(body(page)).toHaveValue('Conservar error');
  });

  test('UI-17 DESIGN-AUDIT-05 · Cancel restores title/body/metadata/checkbox/raw and save status', async ({page}) => {
    await workspace(page); await title(page).fill('Descartar título'); await body(page).fill('Descartar cuerpo');
    await page.getByLabel('Motivo', {exact: true}).fill('Motivo extenso '.repeat(5)); await page.getByRole('combobox', {name: 'Prioridad', exact: true}).selectOption('high'); await page.getByRole('checkbox', {name: 'Tarea completada'}).check();
    const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('bad'); await page.getByRole('button', {name: 'Guardar', exact: true}).click();
    await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
    await expect(title(page)).toHaveValue('Tarea 1'); await expect(body(page)).toHaveValue(''); await expect(page.getByLabel('Motivo', {exact: true})).toHaveValue('Exámenes'); await expect(page.getByRole('combobox', {name: 'Prioridad', exact: true})).toHaveValue('normal');
    await expect(page.getByRole('checkbox', {name: 'Tarea completada'})).not.toBeChecked(); await expect(estimate).toHaveValue(''); await expect(estimate).not.toHaveAttribute('aria-invalid', 'true'); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled();
  });

  test('DESIGN-AUDIT-03/04 INTERFACE-SKILLS-25 · priority is confirmed-only text plus decorative icon', async ({page}) => {
    await workspace(page); const row = nav(page).getByRole('button', {name: 'Tarea 1', exact: true});
    await page.getByRole('combobox', {name: 'Prioridad', exact: true}).selectOption('high'); await expect(row.locator('.priority-badge')).toHaveCount(0);
    await failure(page, 'fallo'); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.locator('#save-error')).toContainText('Fallo simulado'); await expect(row.locator('.priority-badge')).toHaveCount(0);
    await save(page); const high = nav(page).getByRole('button', {name: 'Tarea 1 · Prioridad Alta', exact: true}); await expect(high.locator('.priority-badge')).toContainText('Alta'); await expect(high.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('tab', {name: 'Agenda', exact: true}).click(); const agenda = page.getByRole('tabpanel', {name: 'Agenda'}); await expect(agenda.getByRole('button', {name: /Tarea 1.*Prioridad Alta/})).toBeVisible();
    await page.getByRole('combobox', {name: 'Prioridad', exact: true}).selectOption('normal'); await save(page); await expect(nav(page).getByRole('button', {name: 'Tarea 1', exact: true}).locator('.priority-badge')).toHaveCount(0); await expect(agenda.getByRole('button', {name: /Tarea 1/})).not.toHaveAccessibleName(/Prioridad/);
  });

  test('UI-08 EMIL-SKILLS-10 INTERFACE-SKILLS-23/29/30 · literals, title extremes, newline normalization via fill and Enter', async ({page}) => {
    await workspace(page); const literal = '<img src=x onerror=alert(1)>', content = '<script>not executed</script>';
    await title(page).fill(literal); await body(page).fill(content); await save(page); await select(page, 'Revisar insumos'); await select(page, literal);
    await expect(title(page)).toHaveValue(literal); await expect(body(page)).toHaveValue(content); await expect(page.locator('.editor img,.editor script')).toHaveCount(0);
    const long = '文字á'.repeat(100); await title(page).fill(long); await title(page).press('Enter'); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled(); await expect(title(page)).toHaveValue(long);
    const clean = await page.locator('.save-feedback').textContent(); await title(page).press('Enter'); expect(await page.locator('.save-feedback').textContent()).toBe(clean);
    await title(page).fill('A'); await save(page); await title(page).fill('Línea uno\nLínea dos'); await expect(title(page)).toHaveValue('Línea uno Línea dos');
  });

  test('EMIL-SKILLS-01/02/03 · unresolved errors survive unrelated edits and clear only when resolved', async ({page}) => {
    await workspace(page); const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('abc');
    const planned = await timeField(page, /^Hora prevista/, 'Hora local · 24 h'); await planned.fill('25:00');
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await expect(planned).toHaveAttribute('aria-invalid', 'true');
    await body(page).fill('Otra edición'); await estimate.fill('def'); await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await expect(planned).toHaveAttribute('aria-invalid', 'true');
    await estimate.fill('007'); await expect(estimate).not.toHaveAttribute('aria-invalid', 'true'); await expect(planned).toHaveAttribute('aria-invalid', 'true'); await planned.fill(''); await expect(planned).not.toHaveAttribute('aria-invalid', 'true');
    const date = await timeField(page, /^Fecha/, 'Día / mes / año'); await date.fill(''); await planned.fill('12:00'); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(date).toHaveAttribute('aria-invalid', 'true'); await planned.fill(''); await expect(date).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('EMIL-SKILLS-04 INTERFACE-SKILLS-09 · note visible name, title validation and body-only draft', async ({page}, info) => {
    await select(page, 'Notas rápidas'); const noteTitle = page.getByRole('textbox', {name: 'Título de nota'}), noteBody = page.getByRole('textbox', {name: 'Texto de la nota'});
    await expect(page.getByText('Texto de la nota', {exact: true})).toBeVisible(); await expect(noteBody).toHaveAccessibleName('Texto de la nota'); await expect(page.getByLabel('Motivo', {exact: true})).toHaveCount(0); await info.attach('normal-note', {body: await stableCapture(page), contentType: 'image/png'});
    await noteTitle.fill('   '); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(noteTitle).toHaveAttribute('aria-invalid', 'true'); await noteBody.fill('Borrador de nota'); await expect(noteTitle).toHaveAttribute('aria-invalid', 'true'); await noteTitle.fill('Nota válida'); await expect(noteTitle).not.toHaveAttribute('aria-invalid', 'true'); await save(page);
    await select(page, 'Inicio'); await select(page, 'Notas rápidas'); await expect(noteTitle).toHaveValue('Nota válida'); await expect(noteBody).toHaveValue('Borrador de nota');
  });
});

async function noEditorOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const zone of await page.locator('.workspace,.toolbar,.editor,.metadata,.navigation,.time-content').all()) if (await zone.isVisible()) expect(await zone.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
}

test.describe('4A native viewport, raw-state and editor checks · file', () => {
  test.beforeEach(async ({page, context}) => {
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {const target = route.request().url(); if (/^(file:|data:|blob:)/.test(target)) return route.continue(); status.external.push(target); return route.abort();});
  });
  for (const width of [320, 390, 699, 700, 999, 1000, 1024, 1440]) for (const theme of ['light', 'dark'] as const) test(`UI-03/11/21 DESIGN-COMPLETE-06 VIEWPORT-04/09/11 · ${width}px ${theme}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 844}); await page.goto(pathToFileURL(artifact).href); await appearance(page, theme); await workspace(page);
    if (width === 1440 || width === 390) await info.attach(`normal-task-${width}-${theme}`, {body: await stableCapture(page), contentType: 'image/png'});
    const titleNode = await title(page).elementHandle(), bodyNode = await body(page).elementHandle();
    await title(page).fill('文字á'.repeat(100)); await body(page).fill('Notas con palabraslargas'.repeat(40)); await page.getByLabel('Motivo', {exact: true}).fill('Contexto '.repeat(9)); await noEditorOverflow(page);
    const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('abc'); await closeTime(page);
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(estimate).toBeFocused(); await expect(estimate).toHaveValue('abc'); await expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#estimate')).toHaveCount(1); await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode', width >= 1000 ? 'column' : 'drawer');
    await page.getByRole('tab', {name: 'Agenda', exact: true}).click(); await page.getByRole('tab', {name: 'Tarea', exact: true}).click(); await expect(estimate).toHaveValue('abc'); await expect(page.getByRole('button', {name: /^Estimación/})).toHaveAttribute('aria-expanded', 'true');
    await closeTime(page); await body(page).press('End'); await body(page).press('a'); await expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await appearance(page, theme === 'light' ? 'dark' : 'light'); await appearance(page, theme);
    expect(await title(page).evaluate((node, original) => node === original, titleNode)).toBe(true); expect(await body(page).evaluate((node, original) => node === original, bodyNode)).toBe(true);
    await expect(estimate).toHaveValue('abc'); await noEditorOverflow(page);
    if (width < 1000) await page.getByRole('button', {name: 'Mostrar Tiempo'}).click();
    await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await info.attach(`4A-${width}-${theme}-invalid-time`, {body: await stableCapture(page), contentType: 'image/png'});
    await closeTime(page);
    const checkbox = page.getByRole('checkbox', {name: 'Tarea completada'}), label = checkbox.locator('..');
    await expect(label).toHaveJSProperty('tagName', 'LABEL'); await expect(label.locator('input,button')).toHaveCount(1); const box = await label.boundingBox(); expect(box!.width).toBe(44); expect(box!.height).toBe(44);
    await page.emulateMedia({forcedColors: 'active'}); await expect(checkbox).toBeVisible(); expect(await checkbox.evaluate((node) => getComputedStyle(node).appearance)).not.toBe('none'); await page.emulateMedia({forcedColors: 'none'});
    await info.attach(`4A-${width}-${theme}-editor`, {body: await stableCapture(page), contentType: 'image/png'});
  });
});

test.describe('4A native edit and finite-delay fixture · file', () => {
  test.beforeEach(async ({page, context}) => {
    await page.setViewportSize({width: 1440, height: 1000}); const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});
  });
  for (const method of ['Volver', 'Escape']) test(`UI-06 · ${method} returns focus to the exact visible origin`, async ({page}) => {
    await page.goto(pathToFileURL(artifact).href); await workspace(page); await body(page).fill('Borrador protegido');
    const origin = nav(page).getByRole('button', {name: 'Revisar insumos', exact: true}); await origin.click(); await expect(dialog(page)).toBeVisible();
    if (method === 'Volver') await dialog(page).getByRole('button', {name: 'Volver'}).click(); else await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden(); await expect(origin).toBeFocused(); await expect(body(page)).toHaveValue('Borrador protegido');
  });

  test('VIEWPORT-10 · real keyboard undo/redo, selection and outside focus survive docking', async ({page}, info) => {
    await page.goto(pathToFileURL(artifact).href); await workspace(page); const original = await body(page).elementHandle();
    await body(page).fill(''); await body(page).click(); await page.keyboard.type('Edición nativa'); await page.keyboard.press('ControlOrMeta+z'); const undoValue = await body(page).inputValue(); expect(undoValue).not.toBe('Edición nativa'); await info.attach('native-undo-control', {body: JSON.stringify({before: 'Edición nativa', afterUndo: undoValue}), contentType: 'application/json'}); await page.keyboard.press('ControlOrMeta+Shift+z'); await expect(body(page)).toHaveValue('Edición nativa');
    await body(page).press('Home'); await body(page).press('ArrowRight'); await body(page).press('Shift+ArrowRight'); await body(page).press('Shift+ArrowRight');
    const selection = await body(page).evaluate((node: HTMLTextAreaElement) => ({start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection}));
    for (const width of [999, 1000, 390, 1440]) {await page.setViewportSize({width, height: 1000}); await expect(body(page)).toBeFocused(); expect(await body(page).evaluate((node, previous) => node === previous, original)).toBe(true); expect(await body(page).evaluate((node: HTMLTextAreaElement) => ({start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection}))).toEqual(selection);}
    await page.keyboard.press('ControlOrMeta+z'); await expect(body(page)).toHaveValue(undoValue); await page.keyboard.press('ControlOrMeta+Shift+z'); await expect(body(page)).toHaveValue('Edición nativa');
  });

  test('UI-05 HISTORY-07 · finite real adapter locks editing and retains Forward while saving or completing', async ({page}) => {
    await page.goto(`${pathToFileURL(resolve('dist-layout/layout-harness.html')).href}?fixture=product-delayed`); await expect(title(page)).toHaveValue('Tarea 1');
    await select(page, 'Inicio'); await workspace(page); await select(page, 'Revisar insumos'); await page.evaluate(() => history.back()); await expect(title(page)).toHaveValue('Tarea 1'); await expect.poll(() => index(page)).toBe(2);
    await body(page).fill('Guardado pendiente'); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(page.getByRole('button', {name: 'Guardando…', exact: true})).toBeDisabled();
    await expect(title(page)).toHaveAttribute('readonly'); await expect(body(page)).toHaveAttribute('readonly'); await expect(page.getByLabel('Motivo', {exact: true})).toHaveAttribute('readonly'); await expect(page.getByRole('combobox', {name: 'Prioridad', exact: true})).toBeDisabled(); await expect(page.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled();
    for (const id of ['date', 'time', 'estimate', 'performed', 'duration']) await expect(page.locator(`#${id}`)).toBeDisabled();
    await body(page).press('x'); await expect(body(page)).toHaveValue('Guardado pendiente'); await page.evaluate(() => history.back()); await expect.poll(() => index(page)).toBe(2); await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeDisabled(); await expect(body(page)).not.toHaveAttribute('readonly');
    const length = await page.evaluate(() => history.length); await page.getByRole('checkbox', {name: 'Completar Revisar insumos'}).click(); await expect(body(page)).toHaveAttribute('readonly');
    await page.evaluate(() => history.back()); await expect.poll(() => index(page)).toBe(2); await expect(body(page)).not.toHaveAttribute('readonly'); await page.evaluate(() => history.forward()); await expect(title(page)).toHaveValue('Revisar insumos'); await expect(page.getByRole('checkbox', {name: 'Tarea completada'})).toBeChecked(); expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('HISTORY-10 · emulated composition events keep Enter uncancelled and normalize only at compositionend', async ({page}) => {
    await page.goto(pathToFileURL(artifact).href); await workspace(page); await title(page).dispatchEvent('compositionstart'); await title(page).fill('Composición\nactiva'); await expect(title(page)).toHaveValue('Composición\nactiva');
    const prevented = await title(page).evaluate((node) => {const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true, isComposing: true, keyCode: 229}); node.dispatchEvent(event); return event.defaultPrevented;}); expect(prevented).toBe(false); await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeEnabled(); await title(page).dispatchEvent('compositionend'); await expect(title(page)).toHaveValue('Composición activa');
  });
});

test.describe('4A product filter and checkbox focus · file', () => {
  test.beforeEach(async ({page, context}) => {await page.setViewportSize({width: 1440, height: 480}); const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message)); await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();}); await page.goto(pathToFileURL(artifact).href); await workspace(page);});
  test('UI-15 DESIGN-AUDIT-06 INTERFACE-SKILLS-08 · filter/query preserve editor, scroll and escaped draft', async ({page}) => {
    await body(page).fill('Borrador <literal>'); const original = await body(page).elementHandle(), scroll = page.getByTestId('nav-scroll');
    await scroll.evaluate((node) => {node.scrollTop = 30;}); const position = await scroll.evaluate((node) => node.scrollTop);
    await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click(); await expect(nav(page).getByRole('button', {name: 'Pendientes', exact: true})).toHaveAttribute('aria-pressed', 'true');
    expect(await scroll.evaluate((node) => node.scrollTop)).toBe(position); expect(await body(page).evaluate((node, previous) => node === previous, original)).toBe(true);
    await page.getByRole('searchbox', {name: 'Buscar tareas'}).fill('<desconocido>'); await expect(page.getByText('Sin coincidencias para «<desconocido>».', {exact: true})).toBeVisible(); await page.getByRole('button', {name: 'Limpiar filtros'}).click(); await expect(page.getByRole('searchbox', {name: 'Buscar tareas'})).toHaveValue(''); await expect(nav(page).getByRole('button', {name: 'Todas', exact: true})).toHaveAttribute('aria-pressed', 'true'); await expect(body(page)).toHaveValue('Borrador <literal>');
  });
  test('UI-19 INTERFACE-SKILLS-04 · cancelling a guarded checkbox restores confirmed state; discard completes with focus', async ({page}, info) => {
    await body(page).fill('Borrador de tarea actual'); const checkbox = nav(page).getByRole('button', {name: 'Revisar insumos', exact: true}).locator('..').getByRole('checkbox'); await checkbox.click(); await dialog(page).getByRole('button', {name: 'Volver'}).click(); await expect(checkbox).not.toBeChecked(); await expect(checkbox).toBeFocused(); await expect(body(page)).toHaveValue('Borrador de tarea actual');
    await checkbox.click(); await dialog(page).getByRole('button', {name: 'Descartar cambios'}).click(); await expect(checkbox).toBeChecked(); await expect(checkbox).toBeFocused(); await expect(title(page)).toHaveValue('Tarea 1');
    const tabState = await nav(page).locator('button,input,select,textarea').evaluateAll((nodes) => nodes.map((node) => ({tag: node.tagName, key: node.getAttribute('data-focus-key'), name: node.getAttribute('aria-label') || node.textContent, tabIndex: (node as HTMLElement).tabIndex, stored: node.getAttribute('data-tabindex'), visible: node.getClientRects().length > 0})));
    await info.attach('guarded-completion-tab-state', {body: JSON.stringify(tabState, null, 2), contentType: 'application/json'});
    await checkbox.press('Tab');
    await info.attach('guarded-completion-after-tab', {body: JSON.stringify(await page.evaluate(() => ({tag: document.activeElement?.tagName, key: document.activeElement?.getAttribute('data-focus-key'), name: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent})), null, 2), contentType: 'application/json'});
    await expect(nav(page).getByRole('button', {name: 'Revisar insumos', exact: true})).toBeFocused();
  });
  test('INTERFACE-SKILLS-05/26 · each pending checkbox completes once and the last removed target falls back safely', async ({page}) => {
    await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click();
    for (const name of ['Tarea 1', 'Revisar insumos', 'Preparar educación', 'Revisar material']) {const checkbox = page.getByRole('checkbox', {name: `Completar ${name}`, exact: true}); if (name === 'Revisar material' && await nav(page).getByRole('button', {name: 'Lista 2', exact: true}).getAttribute('aria-expanded') !== 'true') await nav(page).getByRole('button', {name: 'Lista 2', exact: true}).click(); await expect(checkbox).toBeVisible(); await checkbox.click(); await expect(checkbox).toHaveCount(0); await expect(page.getByRole('main')).toBeFocused();}
    await expect(page.getByText('No hay tareas pendientes.', {exact: true})).toBeVisible(); await expect(page.getByRole('main')).toBeFocused();
  });
});

test.describe('4A Home and confirmed Agenda · file', () => {
  test.beforeEach(async ({page, context}) => {await page.setViewportSize({width: 1440, height: 1000}); const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message)); await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});});
  for (const [sample, subtitle] of [[0.1, '¿Qué haremos hoy?'], [0.3, '¿Por dónde empezamos?'], [0.6, '¿Qué tienes en mente?'], [0.9, '¿En qué te ayudo hoy?']] as const) test(`UI-14/20/40/41 DESIGN-AUDIT-11 · stable Spanish Home sample ${sample}`, async ({page}) => {
    await page.addInitScript((value) => {Math.random = () => value;}, sample); await page.goto(pathToFileURL(artifact).href);
    const greeting = page.getByRole('heading', {name: 'Hola, Demo.'}), original = await greeting.elementHandle(); await expect(page.locator('.greeting>p')).toHaveText(subtitle); await expect(page.locator('.home-summary>p')).toHaveText('Turno de día · 4 pendientes');
    await page.getByRole('button', {name: 'Mostrar Tiempo'}).click(); await expect(page.getByRole('tab', {name: 'Agenda', exact: true})).toHaveAttribute('aria-selected', 'true'); await page.getByRole('tab', {name: 'Tarea', exact: true}).click(); await expect(page.getByText('Selecciona una tarea', {exact: true})).toBeVisible(); await expect(page.locator('#date')).toHaveCount(0); await closeTime(page);
    expect(await greeting.evaluate((node, previous) => node === previous, original)).toBe(true); await expect(page.locator('.greeting>p')).toHaveText(subtitle);
    await workspace(page); await page.getByRole('checkbox', {name: 'Completar Tarea 1'}).click(); await expect(page.getByRole('checkbox', {name: 'Tarea completada'})).toBeChecked(); await select(page, 'Inicio'); await expect(greeting).toBeVisible(); await expect(page.locator('.greeting>p')).toHaveText(subtitle); await expect(page.locator('.home-summary>p')).toHaveText('Turno de día · 3 pendientes');
  });

  test('DESIGN-COMPLETE-08 · custom preview profile greets by name while normal product remains generic', async ({page}) => {
    const name = 'Lista de demostración 文字 العربية Español '.repeat(12).slice(0, 300).trim();
    await page.goto(`${pathToFileURL(resolve('dist-layout/layout-harness.html')).href}?fixture=product-long`); await select(page, 'Inicio'); await expect(page.locator('.greeting h1')).toHaveText(`Hola, ${name}.`);
    await page.goto(pathToFileURL(artifact).href); await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
  });

  test('UI-25 INTERFACE-SKILLS-25 · Agenda is confirmed, includes undated and selected completed tasks despite filters', async ({page}, info) => {
    await page.goto(pathToFileURL(artifact).href); await workspace(page); await page.getByRole('checkbox', {name: 'Tarea completada'}).check(); await save(page);
    await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click(); await page.getByRole('searchbox', {name: 'Buscar tareas'}).fill('Revisar insumos'); await page.getByRole('tab', {name: 'Agenda', exact: true}).click();
    const agenda = page.getByRole('tabpanel', {name: 'Agenda'}); await expect(agenda.getByRole('heading', {name: 'Sin fecha'})).toBeVisible(); await expect(agenda.getByRole('button', {name: /Preparar educación/})).toBeVisible(); await expect(agenda.getByRole('button', {name: /Tarea 1.*Completada/})).toHaveAttribute('aria-current', 'true'); await expect(agenda.getByText('4 tareas · 3 pendientes', {exact: true})).toBeVisible(); await expect(agenda.getByRole('button', {name: /Revisar material.*Prioridad Alta/})).toBeVisible(); await info.attach('confirmed-agenda', {body: await stableCapture(page), contentType: 'image/png'});
    await page.getByRole('combobox', {name: 'Prioridad', exact: true}).selectOption('high'); await expect(agenda.getByRole('button', {name: /Tarea 1/})).not.toHaveAccessibleName(/Prioridad/); await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
  });

  for (const theme of ['light', 'dark'] as const) test(`VISIBILITY-05 EMIL-SKILLS-16 DESIGN-COMPLETE-09 · selected tabs retain background ${theme}`, async ({page}, info) => {
    await page.goto(pathToFileURL(artifact).href); await appearance(page, theme); await workspace(page); const selected = page.getByRole('tab', {name: 'Tarea', exact: true}), other = page.getByRole('tab', {name: 'Agenda', exact: true});
    const selectedColor = await colorToken(page, '--selected'), hoverColor = await colorToken(page, '--hover');
    await expect(selected).toHaveCSS('background-color', selectedColor); await selected.hover(); await expect(selected).toHaveCSS('background-color', selectedColor);
    await other.hover(); const capabilities = await other.evaluate((node) => ({hoverMedia: matchMedia('(hover:hover)').matches, hovered: node.matches(':hover'), backgroundAtEvent: getComputedStyle(node).backgroundColor}));
    await info.attach('hover-capabilities', {body: JSON.stringify(capabilities), contentType: 'application/json'}); expect(capabilities.hoverMedia).toBe(true); expect(capabilities.hovered).toBe(true);
    await expect(other).toHaveCSS('background-color', hoverColor); await other.click(); await expect(other).toHaveCSS('background-color', selectedColor);
    await selected.hover(); await expect(selected).toHaveCSS('background-color', hoverColor); await other.hover(); await expect(other).toHaveCSS('background-color', selectedColor);
    const ratios = await page.evaluate(() => {const rgb = (text: string) => text.match(/[\d.]+/g)!.slice(0, 3).map(Number); const lum = (color: number[]) => color.map((x) => {const y = x / 255; return y <= 0.04045 ? y / 12.92 : ((y + 0.055) / 1.055) ** 2.4;}).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i]!, 0); const contrast = (a: string, b: string) => {const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);}; const field = getComputedStyle(document.getElementById('title')!), tab = getComputedStyle(document.querySelector('[role=tab][aria-selected=true]')!); return {fieldBorder: contrast(field.borderTopColor, field.backgroundColor), text: contrast(field.color, field.backgroundColor), tabText: contrast(tab.color, tab.backgroundColor)};});
    expect(ratios.fieldBorder).toBeGreaterThanOrEqual(3); expect(ratios.text).toBeGreaterThanOrEqual(4.5); expect(ratios.tabText).toBeGreaterThanOrEqual(4.5);
  });
});

// Extra product flows from the independent 73-row review. Slot/harness evidence
// cannot replace these transitions or measured control states.
test.describe('4A canonical closure gaps · file', () => {
  test.beforeEach(async ({page, context}) => {
    await page.setViewportSize({width: 1440, height: 480});
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status);
    page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {
      const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue();
      status.external.push(url); return route.abort();
    });
    await page.goto(pathToFileURL(artifact).href);
  });

  test('VIEWPORT-05/09/10/11 · temporal-only dirty, real docking, scroll and native fullscreen preserve controls', async ({page}, info) => {
    await workspace(page); await appearance(page, 'dark');
    await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click();
    const text = 'Una línea de notas conservadas.\n'.repeat(160);
    await body(page).fill(text); await save(page);
    const bodyNode = await body(page).elementHandle(), form = page.locator('#editor-form'), formNode = await form.elementHandle();
    await body(page).evaluate((node: HTMLTextAreaElement) => {node.scrollTop = 47;});
    const bodyScroll = await body(page).evaluate((node) => node.scrollTop); expect(bodyScroll).toBeGreaterThan(0);
    const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'), estimateNode = await estimate.elementHandle();
    await estimate.fill('ab'); await estimate.press('End'); await page.keyboard.type('c');
    await expect(page.getByRole('button', {name: 'Guardar', exact: true})).toBeEnabled(); await expect(page.locator('.save-feedback')).toHaveText('Cambios sin guardar');
    expect(await body(page).evaluate((node) => node.scrollTop)).toBe(bodyScroll); expect(await form.evaluate((node, previous) => node === previous, formNode)).toBe(true);
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await page.setViewportSize({width: 999, height: 480}); await expect(page.getByRole('button', {name: 'Mostrar Tiempo'})).toBeFocused();
    await page.getByRole('button', {name: 'Mostrar Tiempo'}).click(); await expect(estimate).toBeVisible(); await estimate.focus();
    const scroller = page.locator('.time-content'); await scroller.evaluate((node) => {node.scrollTop = 53;});
    const timeScroll = await scroller.evaluate((node) => node.scrollTop); expect(timeScroll).toBeGreaterThan(0);
    await page.setViewportSize({width: 1000, height: 480}); await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode', 'column'); await expect(estimate).toBeFocused();
    expect(await scroller.evaluate((node) => node.scrollTop)).toBe(timeScroll);
    for (const width of [1440, 1920, 1024, 1000, 1440]) {
      await page.setViewportSize({width, height: 480}); await expect(estimate).toBeFocused();
      expect(await estimate.evaluate((node, previous) => node === previous, estimateNode)).toBe(true);
      expect(await body(page).evaluate((node, previous) => node === previous, bodyNode)).toBe(true);
      expect(await form.evaluate((node, previous) => node === previous, formNode)).toBe(true);
      await expect(estimate).toHaveValue('abc'); await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await expect(page.locator('#estimate')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(nav(page).getByRole('button', {name: 'Pendientes', exact: true})).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', {name: /^Estimación/})).toHaveAttribute('aria-expanded', 'true'); await expect(title(page)).toHaveValue('Tarea 1');
      expect(await scroller.evaluate((node) => node.scrollTop)).toBe(timeScroll); expect(await body(page).evaluate((node) => node.scrollTop)).toBe(bodyScroll);
    }
    await page.evaluate(() => document.dispatchEvent(new Event('fullscreenchange'))); // Emulated event with unchanged width/height.
    expect(await scroller.evaluate((node) => node.scrollTop)).toBe(timeScroll); expect(await body(page).evaluate((node) => node.scrollTop)).toBe(bodyScroll);
    await estimate.press('ControlOrMeta+z'); await expect(estimate).toHaveValue('ab'); await estimate.press('ControlOrMeta+Shift+z'); await expect(estimate).toHaveValue('abc');
    for (const property of [/^Fecha/, /^Hora prevista/, /^Recordatorio/, /^Realización/, /^Duración registrada/, /^Actividad/]) {const trigger = page.getByRole('button', {name: property}); if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();}
    const range = (control: Locator) => control.evaluate((node) => ({top: node.scrollTop, height: node.scrollHeight, client: node.clientHeight, max: Math.max(0, node.scrollHeight - node.clientHeight)}));
    await estimate.click(); const beforeFullscreen = {time: await range(scroller), body: await range(body(page))}; expect(beforeFullscreen.time.top).toBeGreaterThan(0);
    expect(await page.evaluate(() => navigator.userActivation.isActive)).toBe(true);
    await page.evaluate(() => document.documentElement.requestFullscreen()); await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    expect(await estimate.evaluate((node, previous) => node === previous, estimateNode)).toBe(true); await expect(estimate).toHaveValue('abc');
    const duringFullscreen = {time: await range(scroller), body: await range(body(page))};
    await page.evaluate(() => document.exitFullscreen()); await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    expect(await body(page).evaluate((node, previous) => node === previous, bodyNode)).toBe(true); expect(await estimate.evaluate((node, previous) => node === previous, estimateNode)).toBe(true);
    const afterFullscreen = {time: await range(scroller), body: await range(body(page))};
    for (const key of ['time', 'body'] as const) {for (const measured of [duringFullscreen[key], afterFullscreen[key]]) {expect(measured.top).toBeGreaterThanOrEqual(0); expect(measured.top).toBeLessThanOrEqual(measured.max);} if (duringFullscreen[key].max >= beforeFullscreen[key].top && afterFullscreen[key].max >= beforeFullscreen[key].top) expect(afterFullscreen[key].top).toBe(beforeFullscreen[key].top);}
    await expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await info.attach('real-time-docking', {body: JSON.stringify({bodyScroll, timeScroll, beforeFullscreen, duringFullscreen, afterFullscreen, clampClassification: 'Exact conservation is asserted only when observed ranges retain the offset. Insufficient-range observations are diagnostic only and do not prove legitimate clamp or scroll conservation.', actualFullscreenAPI: true, physicalIME: false}), contentType: 'application/json'});
    await nav(page).getByRole('button', {name: 'Tarea 1', exact: true}).focus(); await page.setViewportSize({width: 699, height: 480}); await expect(page.getByRole('button', {name: 'Abrir navegación'})).toBeFocused();
  });

  test('VIEWPORT-08 INTERFACE-SKILLS-03 · explicit hidden preference keeps an open drawer when widening', async ({page}) => {
    await workspace(page); await page.getByRole('button', {name: 'Cerrar Tiempo', exact: true}).click();
    const trigger = page.getByRole('button', {name: 'Mostrar Tiempo'}); await expect(trigger).toBeFocused(); await expect(page.locator('#time-panel')).toBeHidden();
    await page.setViewportSize({width: 900, height: 480}); await trigger.click();
    const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('007'); const original = await estimate.elementHandle();
    await page.setViewportSize({width: 1600, height: 480}); await expect(page.getByRole('dialog', {name: 'Tiempo', exact: true})).toBeVisible(); await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode', 'drawer');
    expect(await estimate.evaluate((node, previous) => node === previous, original)).toBe(true); await expect(estimate).toHaveValue('007');
    await closeTime(page); await expect(page.locator('#time-panel')).toBeHidden(); await expect(page.getByTestId('app-shell')).not.toHaveClass(/has-time/);
  });

  test('VIEWPORT-04 · real Agenda preserves selected tab and focus across999→1000', async ({page}) => {
    await page.setViewportSize({width: 999, height: 600}); await workspace(page); await page.getByRole('button', {name: 'Mostrar Tiempo'}).click();
    const agendaTab = page.getByRole('tab', {name: 'Agenda', exact: true}); await agendaTab.click(); const original = await agendaTab.elementHandle();
    await page.setViewportSize({width: 1000, height: 600}); await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode', 'column'); await expect(agendaTab).toHaveAttribute('aria-selected', 'true'); await expect(agendaTab).toBeFocused();
    expect(await agendaTab.evaluate((node, previous) => node === previous, original)).toBe(true); await expect(page.getByRole('tabpanel', {name: 'Agenda'}).getByRole('heading', {name: 'Sin fecha'})).toBeVisible();
    await page.setViewportSize({width: 999, height: 600}); await expect(page.locator('#time-panel')).toBeHidden(); await expect(page.getByRole('button', {name: 'Mostrar Tiempo'})).toBeFocused();
  });

  test('VIEWPORT-07 · Home Time stays an overlay and preserves greeting through width and fullscreenchange', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844}); const home = page.getByRole('main'), original = await home.elementHandle(), greeting = await page.locator('.greeting').textContent();
    await page.getByRole('button', {name: 'Mostrar Tiempo'}).click(); await page.setViewportSize({width: 1920, height: 844});
    await page.evaluate(() => document.dispatchEvent(new Event('fullscreenchange'))); // Event emulation, not the native API case above.
    await expect(page.getByRole('dialog', {name: 'Tiempo', exact: true})).toBeVisible(); await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode', 'drawer'); expect(await original!.evaluate((node) => node.isConnected && document.getElementById('main') === node)).toBe(true);
    await closeTime(page); expect(await page.locator('.greeting').textContent()).toBe(greeting); await expect(page.getByRole('button', {name: 'Mostrar Tiempo'})).toBeFocused();
  });

  test('UI-02/04 · mobile fold updates its drawer while raw invalid temporal data survives', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844}); await workspace(page); const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await estimate.fill('abc'); await closeTime(page);
    await openNav(page); const group = nav(page).getByRole('button', {name: 'Lista 1', exact: true}); await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'false'); await expect(nav(page).getByRole('button', {name: 'Tarea 1', exact: true})).toHaveCount(0);
    await group.click(); await expect(nav(page).getByRole('button', {name: 'Tarea 1', exact: true})).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', {name: 'Navegación', exact: true})).toBeHidden();
    await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await expect(estimate).toBeVisible(); await expect(estimate).toHaveValue('abc'); await expect(estimate).toHaveAttribute('aria-invalid', 'true'); await expect(page.locator('#estimate')).toHaveCount(1);
  });

  test('UI-11 · valid raw0 and empty persist after dismissing the mobile Time drawer', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844}); await workspace(page);
    for (const value of ['0', '']) {const field = await timeField(page, /^Estimación/, 'Minutos estimados'); await field.fill(value); await closeTime(page); await save(page); const reopened = await timeField(page, /^Estimación/, 'Minutos estimados'); await expect(reopened).toHaveValue(value); await closeTime(page);}
  });

  test('INTERFACE-SKILLS-27 · keyboard Collapsible has one association, no closed tab stop and preserves raw', async ({page}) => {
    await workspace(page); const trigger = page.getByRole('button', {name: /^Estimación/}); await trigger.focus(); await trigger.press('Enter'); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panelId = await trigger.getAttribute('aria-controls'); expect(panelId).toBeTruthy(); await expect(page.locator(`[id="${panelId}"]`)).toHaveCount(1);
    const field = page.getByLabel('Minutos estimados', {exact: true}); await field.fill('abc'); await trigger.focus(); await trigger.press('Space'); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(field).toBeHidden(); await expect(trigger).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByRole('button', {name: /^Recordatorio/})).toBeFocused(); await trigger.focus(); await trigger.press('Space'); await expect(field).toHaveValue('abc'); await expect(field).toBeVisible(); await expect(page.locator('#estimate')).toHaveCount(1);
  });

  test('DESIGN-AUDIT-05 INTERFACE-SKILLS-22 · long visible metadata round-trips after filter/save/reselection', async ({page}) => {
    const reason = 'Motivo detallado para comprobar etiquetas y ajuste de texto '.repeat(2).slice(0, 79);
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 844}); await page.goto(pathToFileURL(artifact).href); await workspace(page);
      const field = page.getByRole('textbox', {name: 'Motivo', exact: true}), priority = page.getByRole('combobox', {name: 'Prioridad', exact: true});
      for (const [control, name] of [[field, 'Motivo'], [priority, 'Prioridad']] as const) {const label = control.locator('..'); await expect(label).toHaveJSProperty('tagName', 'LABEL'); await expect(label.locator('span')).toHaveText(name); await expect(label.locator('span')).toBeVisible();}
      await expect(field).toHaveAttribute('placeholder', 'Ej.: Exámenes'); await field.fill(reason); await priority.selectOption('high'); await save(page);
      await openNav(page); await nav(page).getByRole('button', {name: 'Pendientes', exact: true}).click(); if (width < 700) {await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', {name: 'Navegación', exact: true})).toBeHidden();}
      await select(page, 'Revisar insumos'); await select(page, 'Tarea 1 · Prioridad Alta'); await expect(field).toHaveValue(reason); await expect(priority).toHaveValue('high');
      expect(await field.locator('..').evaluate((node) => getComputedStyle(node).minWidth)).toBe('0px'); await expect(page.locator('.save-footer')).toHaveCSS('flex-wrap', 'wrap'); if (width < 700) {await expect(page.locator('.save-footer')).toHaveCSS('flex-direction', 'column'); await expect(page.locator('.save-footer>div').first()).toHaveCSS('flex-grow', '0');} await noEditorOverflow(page);
    }
  });

  test('INTERFACE-SKILLS-04 · failed and successful sidebar completion preserve the same focus identity', async ({page}) => {
    await workspace(page); await select(page, 'Revisar insumos'); const checkbox = nav(page).getByRole('button', {name: 'Tarea 1', exact: true}).locator('..').getByRole('checkbox');
    await failure(page, 'fallo'); await checkbox.click(); await expect(checkbox).toBeEnabled(); await expect(checkbox).not.toBeChecked(); await expect(checkbox).toBeFocused(); await expect(title(page)).toHaveValue('Revisar insumos');
    await checkbox.click(); await expect(checkbox).toBeChecked(); await expect(checkbox).toBeFocused(); await expect(title(page)).toHaveValue('Revisar insumos');
    await select(page, 'Tarea 1'); await page.getByRole('button', {name: /^Actividad/}).click(); await expect(page.getByText('Versión local 2. No hay historial remoto conectado.', {exact: true})).toBeVisible();
  });

  test('INTERFACE-SKILLS-14 · a delayed completion cannot steal newer search focus', async ({page}) => {
    await page.goto(`${pathToFileURL(resolve('dist-layout/layout-harness.html')).href}?fixture=product-delayed`); await expect(title(page)).toHaveValue('Tarea 1');
    const checkbox = nav(page).getByRole('button', {name: 'Revisar insumos', exact: true}).locator('..').getByRole('checkbox'); await checkbox.click(); await expect(body(page)).toHaveAttribute('readonly');
    const search = page.getByRole('searchbox', {name: 'Buscar tareas'}); await search.fill('Tarea'); await expect(search).toBeFocused(); await expect(body(page)).not.toHaveAttribute('readonly'); await expect(search).toBeFocused();
    await search.fill(''); await expect(checkbox).toBeChecked(); await expect(title(page)).toHaveValue('Tarea 1');
  });

  test('DESIGN-COMPLETE-06 · explicit and system themes retain editor/raw/error and update theme-color', async ({page}) => {
    await page.emulateMedia({colorScheme: 'light'}); await workspace(page); await appearance(page, 'dark'); const original = await body(page).elementHandle();
    const field = await timeField(page, /^Estimación/, 'Minutos estimados'); await field.fill('abc'); await page.getByRole('button', {name: 'Guardar', exact: true}).click(); await body(page).fill('Draft con error conservado');
    await page.emulateMedia({colorScheme: 'light'}); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#171817');
    await appearance(page, 'system'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#ffffff');
    await page.emulateMedia({colorScheme: 'dark'}); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#171817');
    expect(await body(page).evaluate((node, previous) => node === previous, original)).toBe(true); await expect(body(page)).toHaveValue('Draft con error conservado'); await expect(field).toHaveValue('abc'); await expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  test('DESIGN-COMPLETE-07 · mobile disclosure Escape and Demo preserve a real dirty draft', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844}); await workspace(page); await body(page).fill('Borrador bajo el disclosure'); await openNav(page);
    const drawer = page.getByRole('dialog', {name: 'Navegación', exact: true}), more = page.getByRole('button', {name: 'Más opciones'}); await more.click(); await page.getByLabel('Apariencia').focus(); await page.keyboard.press('Escape'); await expect(drawer).toBeVisible(); await expect(more).toBeFocused();
    await more.click(); await page.getByRole('button', {name: 'Demo local: datos sintéticos'}).click(); const demo = page.getByRole('dialog', {name: 'Demostración local'}); await expect(demo).toBeVisible(); await expect(drawer).toBeHidden(); await demo.getByRole('button', {name: 'Cerrar', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Abrir navegación'})).toBeFocused(); await expect(body(page)).toHaveValue('Borrador bajo el disclosure');
  });

  test('INTERFACE-SKILLS-28 · real long-word controls compute break-word, never anywhere', async ({page}) => {
    await workspace(page); await page.getByRole('button', {name: /^Fecha/}).click();
    const controls = page.locator('.nav-item span,.bed-button span,.task-button,.footer-action span,#title,#body,.property-value,.agenda-title'); expect(await controls.count()).toBeGreaterThan(10);
    const wrapping = await controls.evaluateAll((nodes) => nodes.map((node) => ({tag: node.tagName, className: node.className, wrap: getComputedStyle(node).overflowWrap})));
    for (const control of wrapping) expect.soft(control.wrap, `${control.tag}.${control.className}`).toBe('break-word');
  });

  for (const theme of ['light', 'dark'] as const) test(`EMIL-SKILLS-16 · native pressed beats hover on ordinary/filter/current/primary ${theme}`, async ({page}, info) => {
    await appearance(page, theme);
    const observations: unknown[] = [];
    const press = async (control: Locator, token: string) => {
      await control.hover(); await page.mouse.down();
      try {const measured = await control.evaluate((node) => ({background: getComputedStyle(node).backgroundColor, duration: getComputedStyle(node).transitionDuration, active: node.matches(':active')})); observations.push({token, ...measured}); expect(measured.active).toBe(true); await expect.soft(control).toHaveCSS('background-color', await colorToken(page, token)); expect.soft(measured.duration).toBe('0s');}
      finally {await page.mouse.up();}
    };
    await press(page.locator('.home button.primary'), '--solid-pressed'); await expect(title(page)).toHaveValue('Tarea 1');
    await press(nav(page).getByRole('button', {name: 'Todas', exact: true}), '--pressed');
    await press(nav(page).getByRole('button', {name: 'Tarea 1', exact: true}), '--pressed');
    await press(page.getByRole('button', {name: /^Estimación/}), '--pressed');
    const agendaTab = page.getByRole('tab', {name: 'Agenda', exact: true}); await agendaTab.click();
    await press(page.getByRole('tabpanel', {name: 'Agenda'}).getByRole('button', {name: /Tarea 1/}), '--pressed');
    // Selected tab intentionally keeps the source selected background while hover+active.
    await press(agendaTab, '--selected');
    await info.attach('native-pressed-colors', {body: JSON.stringify(observations), contentType: 'application/json'});
  });
});

test.describe('4A canonical visual measures · file', () => {
  test.beforeEach(async ({page, context}) => {
    await page.setViewportSize({width: 1440, height: 900}); const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status);
    page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});
    await page.goto(pathToFileURL(artifact).href);
  });
  for (const theme of ['light', 'dark'] as const) test(`DESIGN-AUDIT-09/10 DESIGN-COMPLETE-09/10 · declared pairs and real geometry ${theme}`, async ({page}, info) => {
    await workspace(page); await appearance(page, theme); const estimate = await timeField(page, /^Estimación/, 'Minutos estimados'); await page.evaluate(() => document.fonts.ready);
    const computed = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement), values: Record<string, string> = {};
      const names = Array.from(root).filter((name) => name.startsWith('--type-')); for (const name of names) values[name] = root.getPropertyValue(name).trim();
      const colorProbe = document.createElement('span'); colorProbe.hidden = true; document.body.append(colorProbe);
      const resolvedColors: {original: string; resolved: string}[] = [];
      const numeric = (color: string): number[] => {
        if (!color.trim() || !CSS.supports('color', color)) throw new Error(`Missing or unsupported built CSS color: ${JSON.stringify(color)}`);
        colorProbe.style.color = color; const resolved = getComputedStyle(colorProbe).color, channels = resolved.match(/[\d.]+/g);
        if (!channels || channels.length < 3) throw new Error(`Cannot resolve built CSS color ${color} as RGB: ${resolved}`);
        resolvedColors.push({original: color, resolved}); return channels.slice(0, 3).map(Number);
      };
      const lum = (color: string) => numeric(color).map((value) => {const x = value / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;}).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i]!, 0);
      const ratio = (a: string, b: string) => {const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);};
      const pairs: {foreground: string; background: string; minimum: number; ratio: number}[] = [];
      const pair = (foreground: string, background: string, minimum: number) => pairs.push({foreground, background, minimum, ratio: ratio(root.getPropertyValue(foreground).trim(), root.getPropertyValue(background).trim())});
      for (const background of ['--canvas', '--sidebar', '--field', '--selected', '--hover', '--pressed']) {for (const foreground of ['--ink', '--secondary']) pair(foreground, background, 4.5); pair('--ink', background, 3);}
      for (const background of ['--solid', '--solid-hover', '--solid-pressed', '--selected-hover']) pair('--on-solid', background, 4.5);
      for (const background of ['--canvas', '--field']) {pair('--control', background, 3); pair('--error', background, 4.5); pair('--error-border', background, 3);} pair('--secondary', '--sidebar', 3);
      colorProbe.remove();
      const form = document.getElementById('editor-form')!, editor = document.getElementById('main')!, formStyle = getComputedStyle(form), editorStyle = getComputedStyle(editor);
      const probe = document.createElement('span'); Object.assign(probe.style, {position: 'absolute', visibility: 'hidden', width: '76ch', height: '1px', font: formStyle.font}); form.append(probe); const width76ch = probe.getBoundingClientRect().width; probe.remove();
      const box = form.getBoundingClientRect(), container = editor.getBoundingClientRect();
      const size = (selector: string) => getComputedStyle(document.querySelector(selector)!).fontSize;
      return {roles: values, pairs, resolvedColors, radii: {control: root.getPropertyValue('--radius-control').trim(), panel: root.getPropertyValue('--radius-panel').trim()}, form: {width: box.width, max: parseFloat(formStyle.maxWidth), width76ch, left: box.left - container.left - parseFloat(editorStyle.paddingLeft), right: container.right - parseFloat(editorStyle.paddingRight) - box.right}, rendered: {title: size('#title'), section: size('.inspector-heading h2'), notesLabel: size('.notes-heading'), body: size('#reason'), small: size('#estimate'), writing: size('#body'), caption: size('.save-feedback'), writingFamily: getComputedStyle(document.getElementById('body')!).fontFamily, synthesis: getComputedStyle(document.body).fontSynthesis}};
    });
    expect(Object.keys(computed.roles)).toHaveLength(6); for (const value of Object.values(computed.roles)) expect(value).toMatch(/rem$/);
    expect(parseFloat(computed.roles['--type-title']!)).toBe(2.125); expect(parseFloat(computed.roles['--type-section']!)).toBe(1.25); expect(parseFloat(computed.roles['--type-caption']!)).toBe(0.8125);
    expect(computed.radii).toEqual({control: '6px', panel: '10px'}); expect(computed.rendered).toMatchObject({title: '34px', section: '20px', notesLabel: '14px', body: '16px', small: '14px', writing: '19px', caption: '13px', synthesis: 'none'}); expect(computed.rendered.writingFamily).toContain('Source Serif Pro');
    for (const pair of computed.pairs) expect.soft(pair.ratio, `${pair.foreground}/${pair.background}`).toBeGreaterThanOrEqual(pair.minimum);
    expect(Math.abs(computed.form.max - computed.form.width76ch)).toBeLessThanOrEqual(1); expect(computed.form.width).toBeLessThanOrEqual(computed.form.max + 1); expect(Math.abs(computed.form.left - computed.form.right)).toBeLessThanOrEqual(1);
    await expect(body(page)).toHaveCSS('border-top-width', '1px'); await expect(body(page)).toHaveCSS('border-top-style', 'solid'); await expect(body(page)).toHaveCSS('padding-left', '12px'); await expect(body(page)).toHaveCSS('padding-top', '10px'); await expect(page.locator('.notes-heading')).toHaveCSS('padding-left', '12px'); await expect(body(page)).toHaveCSS('border-radius', '6px');
    await title(page).focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(title(page)).toBeFocused(); await expect(title(page)).toHaveCSS('outline-width', '2px'); await expect(title(page)).toHaveCSS('outline-style', 'solid'); await expect(title(page)).toHaveCSS('outline-color', await colorToken(page, '--ink'));
    const filter = nav(page).getByRole('button', {name: 'Todas', exact: true}); await expect(filter).toHaveAttribute('aria-pressed', 'true'); expect(await filter.evaluate((node) => getComputedStyle(node).textDecorationLine)).toContain('underline');
    const actual = await filter.evaluate((node) => {const style = getComputedStyle(node); return {border: style.borderTopColor, width: style.borderTopWidth, background: style.backgroundColor};}); expect(actual.width).toBe('1px'); await expect(filter).toHaveCSS('border-top-color', await colorToken(page, '--secondary')); await expect(estimate).toHaveCSS('min-height', '44px');
    await page.getByRole('button', {name: 'Más opciones'}).click(); await expect(page.locator('#more-options')).toHaveCSS('border-radius', '10px'); await page.keyboard.press('Escape');
    const fonts = (await readdir('src/assets/fonts')).filter((name) => name.endsWith('.woff2')), css = await readFile('src/styles/global.css', 'utf8'); expect(fonts).toHaveLength(5); for (const name of fonts) expect(css).toContain(name); for (const name of ['SourceSans3-OFL.txt', 'SourceSerifPro-OFL.txt']) expect(await readFile(`licenses/${name}`, 'utf8')).toContain('SIL OPEN FONT LICENSE');
    await info.attach('declared-token-pairs-and-rendered-measures', {body: JSON.stringify({theme, ...computed, actualFilter: actual, declaredPairsAreNotPaintedPixels: true}), contentType: 'application/json'});
  });
});

test.describe('4A coarse-pointer control contract · product', () => {
  test.use({hasTouch: true, isMobile: true, viewport: {width: 1440, height: 900}});
  test('EMIL-SKILLS-14 INTERFACE-SKILLS-10 · scoped touch manipulation and actual coarse inputs', async ({page, context}, info) => {
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});
    await page.goto(pathToFileURL(artifact).href); await workspace(page); expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(true);
    const field = await timeField(page, /^Estimación/, 'Minutos estimados'); await expect(field).toHaveCSS('font-size', '16px');
    const state = await page.evaluate(() => ({document: [document.documentElement, document.body].map((node) => getComputedStyle(node).userSelect), writing: getComputedStyle(document.getElementById('body')!).userSelect, controls: Array.from(document.querySelectorAll('button,input[type=checkbox]'), (node) => ({tag: node.tagName, touchAction: getComputedStyle(node).touchAction})), overscroll: ['.nav-scroll', '.time-content'].map((selector) => getComputedStyle(document.querySelector(selector)!).overscrollBehavior)}));
    for (const selection of [...state.document, state.writing]) expect(selection).not.toBe('none'); for (const control of state.controls) expect.soft(control.touchAction, control.tag).toBe('manipulation'); for (const value of state.overscroll) expect(value).toBe('contain');
    const current = nav(page).getByRole('button', {name: 'Tarea 1', exact: true}); const ratio = await current.evaluate((node) => {const style = getComputedStyle(node); return parseFloat(style.lineHeight) / parseFloat(style.fontSize);}); expect(ratio).toBeCloseTo(1.4, 5);
    await page.getByRole('tab', {name: 'Agenda', exact: true}).click(); const agenda = page.getByRole('tabpanel', {name: 'Agenda'}).getByRole('button', {name: /Tarea 1/}); expect(await agenda.evaluate((node) => {const style = getComputedStyle(node); return parseFloat(style.lineHeight) / parseFloat(style.fontSize);})).toBeCloseTo(1.4, 5);
    await info.attach('coarse-controls-computed', {body: JSON.stringify({...state, physicalIOS: false}), contentType: 'application/json'});
  });
});

test.describe('Editorial title resize · native regression', () => {
  for (const theme of ['light', 'dark'] as const) test(`task and note long titles refit without typing after resize ${theme}`, async ({page, context}, info) => {
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status); page.on('pageerror', (error) => status.errors.push(error.message));
    await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});
    const value = 'Título de prueba que debe conservarse al cambiar el ancho. '.repeat(6).slice(0, 300), measurements: unknown[] = [];
    for (const note of [false, true]) {
      await page.setViewportSize({width: 1440, height: 900}); await page.goto(pathToFileURL(artifact).href); await appearance(page, theme);
      if (note) await select(page, 'Notas rápidas'); else await workspace(page);
      const control = page.getByRole('textbox', {name: note ? 'Título de nota' : 'Título de tarea'}); await page.evaluate(() => document.fonts.ready); await control.fill(value); await control.focus(); await control.press('Home'); await control.press('Shift+ArrowRight');
      const original = await control.elementHandle(), selection = await control.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd]);
      let initialWideHeight: number | null = null, grewWhenNarrow = false;
      for (const width of [1440, 390, 320, 1440]) {
        await page.setViewportSize({width, height: 900});
        await expect.poll(() => control.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
        if (width === 1440 && initialWideHeight !== null) await expect.poll(() => control.evaluate((node) => node.clientHeight)).toBe(initialWideHeight);
        const height = await control.evaluate((node) => node.clientHeight);
        if (initialWideHeight === null) initialWideHeight = height; else if (width < 1440 && height > initialWideHeight) grewWhenNarrow = true;
        expect(await control.evaluate((node, previous) => node === previous, original)).toBe(true); await expect(control).toHaveValue(value); await expect(control).toBeFocused();
        expect(await control.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual(selection);
        measurements.push({note, width, ...await control.evaluate((node) => ({height: node.clientHeight, scrollHeight: node.scrollHeight, inlineHeight: (node as HTMLElement).style.height}))});
      }
      expect(grewWhenNarrow).toBe(true);
      await control.press('ControlOrMeta+z'); await expect(control).not.toHaveValue(value); await control.press('ControlOrMeta+Shift+z'); await expect(control).toHaveValue(value);
      await info.attach(`${note ? 'note' : 'task'}-long-title-${theme}`, {body: await control.screenshot(), contentType: 'image/png'});
      await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
    }
    await info.attach('title-refit-measures', {body: JSON.stringify(measurements), contentType: 'application/json'});
  });
});

// A viewport scrollWidth check cannot see a focus outline escaping its own card.
// Removing the card inset must fail these actual geometry assertions.
test.describe('Mobile containment regression · real editor', () => {
  for (const width of [320, 375, 390, 430]) for (const theme of ['light', 'dark'] as const) test(`MOBILE-CONTAINMENT · metadata and keyboard focus stay inside the card · ${width} ${theme}`, async ({page, context}, info) => {
    await page.setViewportSize({width, height: 844});
    const status = {errors: [] as string[], external: [] as string[]}; runtime.set(page, status);
    page.on('pageerror', (error) => status.errors.push(error.message)); page.on('console', (message) => {if (message.type() === 'error') status.errors.push(message.text());});
    await context.route('**/*', (route) => {const url = route.request().url(); if (/^(file:|data:|blob:)/.test(url)) return route.continue(); status.external.push(url); return route.abort();});
    await page.goto(pathToFileURL(artifact).href); await appearance(page, theme); await workspace(page); await page.evaluate(() => document.fonts.ready);
    const reason = page.getByRole('textbox', {name: 'Motivo', exact: true}), priority = page.getByRole('combobox', {name: 'Prioridad', exact: true});
    await reason.focus(); await reason.press('Tab'); await expect(priority).toBeFocused();
    const measured: {id: string; control: {left: number; right: number; top: number; bottom: number; width: number; height: number}; card: {left: number; right: number; top: number; bottom: number; width: number; height: number}; form: {left: number; right: number; top: number; bottom: number; width: number; height: number}; ring: number; outlineWidth: number; outlineOffset: number; outlineStyle: string; focusVisible: boolean; fontSize: string; paddingInline: [string, string]}[] = [];
    for (const field of [priority, reason]) {
      if (field === reason) {await priority.press('Shift+Tab'); await expect(reason).toBeFocused();}
      measured.push(await field.evaluate((node) => {
        const box = (element: Element) => {const r = element.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height};};
        const card = node.closest('.metadata')!, form = node.closest('form')!, style = getComputedStyle(node), cardStyle = getComputedStyle(card);
        const outlineWidth = parseFloat(style.outlineWidth), outlineOffset = parseFloat(style.outlineOffset);
        return {id: node.id, control: box(node), card: box(card), form: box(form), ring: outlineWidth + outlineOffset, outlineWidth, outlineOffset, outlineStyle: style.outlineStyle, focusVisible: node.matches(':focus-visible'), fontSize: style.fontSize, paddingInline: [cardStyle.paddingLeft, cardStyle.paddingRight] as [string, string]};
      }));
    }
    const viewport = await page.evaluate(() => {const shell = getComputedStyle(document.querySelector('.app-shell')!); return {innerWidth, documentWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, visualWidth: visualViewport?.width, scale: visualViewport?.scale, safeAreaPadding: [shell.paddingLeft, shell.paddingRight], physicalIPhone: false};});
    await info.attach(`metadata-containment-${width}-${theme}`, {body: JSON.stringify({viewport, measured, keyboardFocus: 'Tab and Shift+Tab', engine: 'Chromium viewport; no physical iPhone or Safari claim'}), contentType: 'application/json'});
    await info.attach(`metadata-focus-${width}-${theme}`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
    for (const field of measured) {
      expect.soft(field.focusVisible, field.id).toBe(true); expect.soft(field.outlineStyle, field.id).toBe('solid'); expect.soft(field.outlineWidth, field.id).toBe(2); expect.soft(field.outlineOffset, field.id).toBe(2);
      expect.soft(field.control.left - field.ring, `${field.id} focus left inside card`).toBeGreaterThanOrEqual(field.card.left); expect.soft(field.control.right + field.ring, `${field.id} focus right inside card`).toBeLessThanOrEqual(field.card.right);
      expect.soft(field.control.top - field.ring, `${field.id} focus top inside card`).toBeGreaterThanOrEqual(field.card.top); expect.soft(field.control.bottom + field.ring, `${field.id} focus bottom inside card`).toBeLessThanOrEqual(field.card.bottom);
      expect.soft(field.control.left, field.id).toBeGreaterThanOrEqual(field.form.left); expect.soft(field.control.right, field.id).toBeLessThanOrEqual(field.form.right);
      expect.soft(field.control.height, field.id).toBeGreaterThanOrEqual(44); expect.soft(field.fontSize, field.id).toBe('16px');
    }
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.clientWidth); expect(viewport.clientWidth).toBe(width);
  });
});
