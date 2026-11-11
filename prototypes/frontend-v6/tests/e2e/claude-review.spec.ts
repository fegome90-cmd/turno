// Claude report regressions on the real product. Chromium is not physical iOS/AT.
import {test, expect, type Page, type Locator, type TestInfo} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const artifact = pathToFileURL(resolve('dist/preview.html')).href;
const nav = (page: Page) => page.getByRole('navigation', {name: 'Principal'});
async function openNav(page: Page) {
  const width = await page.evaluate(() => innerWidth);
  await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode', width < 700 ? 'drawer' : 'column');
  if (width >= 700) {await expect(nav(page)).toBeVisible(); return;}
  const disclosure = page.locator('[data-focus-key="open-nav"]');
  const drawer = page.getByRole('dialog', {name: 'Navegación', exact: true});
  if (await disclosure.getAttribute('aria-expanded') !== 'true') {
    await expect(drawer).toBeHidden();
    await page.getByRole('button', {name: 'Abrir navegación'}).click();
  }
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toBeVisible();
}
async function navigationAction(page: Page, name: string) {await openNav(page); await nav(page).getByRole('button', {name, exact: true}).click();}
async function failNext(page: Page) {
  await openNav(page);
  await page.getByRole('button', {name: 'Más opciones'}).click();
  await page.getByRole('button', {name: 'Demo local: datos sintéticos'}).click();
  const demo = page.getByRole('dialog', {name: 'Demostración local'});
  await demo.getByRole('button', {name: 'Simular fallo'}).click();
  await expect(demo).toBeHidden();
}
async function noticeDoesNotBlock(target: Locator, label: string, info: TestInfo) {
  await target.scrollIntoViewIfNeeded();
  const observed = await target.evaluate((node) => {
    const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const box = (element: Element) => {const b = element.getBoundingClientRect(); return {x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height};};
    const cards = Array.from(document.querySelectorAll('[data-notification-root] .notice')).map((element) => ({box: box(element), pointerEvents: getComputedStyle(element).pointerEvents}));
    const overlap = cards.map(({box: b}) => Math.max(0, Math.min(rect.right, b.right) - Math.max(rect.left, b.x)) * Math.max(0, Math.min(rect.bottom, b.bottom) - Math.max(rect.top, b.y)));
    return {viewport: {width: innerWidth, height: innerHeight}, scroll: {x: scrollX, y: scrollY}, target: box(node), hit: top ? {tag: top.tagName, className: top.className, id: top.id} : null,
      targetHit: top === node || (top !== null && node.contains(top)), cards, overlap,
      regions: Array.from(document.querySelectorAll('[data-notification-root]')).map(box),
      closeButtons: Array.from(document.querySelectorAll('[data-close-notice]')).map((element) => ({box: box(element), pointerEvents: getComputedStyle(element).pointerEvents}))};
  });
  await info.attach(label, {body: JSON.stringify(observed), contentType: 'application/json'});
  expect(observed.targetHit).toBe(true);
  expect(observed.overlap.every((area) => area === 0)).toBe(true);
  for (const close of observed.closeButtons) expect(close.pointerEvents).toBe('auto');
}
for (const width of [1440, 320]) test.describe(`Claude report · width ${width}`, () => {
  const runtime = new WeakMap<Page, string[]>();
  test.beforeEach(async ({page, context}) => {
    const errors: string[] = []; runtime.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', (route) => /^(file:|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
    await page.setViewportSize({width, height: 900});
    await page.goto(artifact);
    await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
  });
  test.afterEach(({page}) => {expect(runtime.get(page)).toEqual([]);});
  test('F1 · failed completion shows the real error and permits a successful retry', async ({page}, info) => {
    // Observed regressions: footer retry at320×844 and Tiempo/Actividad1440×480.
    await page.setViewportSize({width: width === 1440 ? 1440 : 320, height: width === 1440 ? 480 : 844});
    await navigationAction(page, 'Ir al turno actual');
    await expect(page.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Tarea 1');
    await failNext(page);
    await openNav(page);
    await nav(page).getByRole('checkbox', {name: 'Completar Tarea 1', exact: true}).click();
    const notices = page.getByRole('region', {name: 'Avisos'});
    await expect(notices).toBeVisible();
    await expect(notices).toContainText('Fallo simulado');
    await expect(notices.locator('[data-notice-message]')).toHaveCSS('overflow-wrap', 'break-word');
    await expect(page.locator('#live-error')).toContainText('Fallo simulado');
    await expect(page.getByRole('checkbox', {name: 'Tarea completada', exact: true})).not.toBeChecked();
    await info.attach(`F1-notice-${width}`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
    if (width === 1440) {
      const activity = page.getByRole('button', {name: /^Actividad/});
      await noticeDoesNotBlock(activity, 'notice-and-activity-hit-test', info);
      await activity.click(); await expect(activity).toHaveAttribute('aria-expanded', 'true');
    }
    await openNav(page);
    const check = nav(page).getByRole('checkbox', {name: 'Completar Tarea 1', exact: true});
    await expect(check).not.toBeChecked(); await check.click();
    await expect(page.getByRole('checkbox', {name: 'Tarea completada', exact: true})).toBeChecked();
    await expect(page.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Tarea 1');
    // Keep the error visible while retrying the editor; no dismiss/force click.
    const body = page.getByRole('textbox', {name: 'Notas de la tarea'});
    await body.fill('Reintento accesible con aviso visible'); await failNext(page);
    const save = page.getByRole('button', {name: 'Guardar', exact: true}); await save.click();
    await expect(page.locator('#save-error')).toContainText('Fallo simulado');
    await expect(notices).toBeVisible();
    await noticeDoesNotBlock(save, 'notice-and-retry-save-hit-test', info);
    await save.click(); await expect(save).toBeDisabled();
    await expect(body).toHaveValue('Reintento accesible con aviso visible');
    await expect(page.locator('#save-error')).toHaveText('');
    await page.getByRole('button', {name: 'Cerrar aviso', exact: true}).click();
    await expect(notices).toBeHidden();
    await expect(body).toHaveValue('Reintento accesible con aviso visible');
    await info.attach(`F1-retry-visible-${width}`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
  });
  test('F2 · closing from archive names the active shift instead of the displayed archive', async ({page}, info) => {
    await page.getByRole('button', {name: 'Cerrar turno', exact: true}).click();
    let dialog = page.getByRole('dialog', {name: 'Cerrar turno', exact: true});
    await dialog.getByRole('button', {name: 'Cerrar y archivar'}).click(); await expect(dialog).toBeHidden();
    await page.getByRole('main').getByRole('button', {name: 'Iniciar turno', exact: true}).click();
    let name = page.getByRole('dialog', {name: 'Iniciar turno', exact: true});
    await name.getByRole('textbox', {name: 'Nombre del turno'}).fill('Turno B activo');
    await name.getByRole('button', {name: 'Iniciar', exact: true}).click(); await expect(name).toBeHidden();
    await navigationAction(page, 'Archivo de turnos anteriores');
    await page.getByRole('button', {name: /^Turno de día ·/}).click();
    await expect(page.getByText('Turno archivado · Solo lectura. Los pendientes se conservan.')).toBeVisible();
    await page.getByRole('button', {name: 'Cerrar turno', exact: true}).click();
    dialog = page.getByRole('dialog', {name: 'Cerrar turno', exact: true});
    await expect(dialog).toContainText('Se cerrará el turno «Turno B activo»');
    await expect(dialog).toContainText('0 tareas pendientes');
    await expect(dialog).not.toContainText('Turno de día');
    await info.attach(`F2-active-shift-${width}`, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
    await dialog.getByRole('button', {name: 'Volver', exact: true}).click(); await expect(dialog).toBeHidden();
    await expect(page.getByText('Turno archivado · Solo lectura. Los pendientes se conservan.')).toBeVisible();
  });
  test('F3 · creating a list from Notes removes the cross-view note selection without losing its contents', async ({page}) => {
    await navigationAction(page, 'Notas rápidas');
    const title = page.getByRole('textbox', {name: 'Título de nota', exact: true});
    const noteTitle = await title.inputValue();
    const body = page.getByRole('textbox', {name: 'Texto de la nota'}), noteBody = await body.inputValue();
    await navigationAction(page, 'Agregar lista');
    const dialog = page.getByRole('dialog', {name: 'Agregar lista', exact: true});
    await dialog.getByRole('textbox', {name: 'Nombre de lista'}).fill('Lista desde Notas');
    await dialog.getByRole('button', {name: 'Crear', exact: true}).click(); await expect(dialog).toBeHidden();
    await expect(title).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText('Selecciona una tarea o agrega la primera.');
    await navigationAction(page, 'Notas rápidas');
    await expect(title).toHaveValue(noteTitle); await expect(body).toHaveValue(noteBody);
  });
});

for (const width of [1440, 390]) for (const note of [false, true]) for (const action of ['Guardar', 'Cancelar'] as const) {
  for (const modality of (width === 1440 ? ['pointer', 'keyboard'] : ['pointer']) as ('pointer'|'keyboard')[]) {
    test(`H2 · ${width} ${note ? 'note' : 'task'} ${action} ${modality} returns focus to the preserved writing field`, async ({page}, info) => {
      await page.setViewportSize({width, height: 900});
      await page.goto(artifact);
      await expect(page.getByRole('heading', {name: 'Hola, Demo.'})).toBeVisible();
      await navigationAction(page, note ? 'Notas rápidas' : 'Ir al turno actual');
      const field = page.getByRole('textbox', {name: note ? 'Texto de la nota' : 'Notas de la tarea', exact: true});
      await expect(field).toBeVisible();
      const initial = await field.inputValue(), handle = await field.elementHandle();
      await field.fill(initial + ' H2 conservado');
      const button = page.getByRole('button', {name: action, exact: true});
      if (modality === 'pointer') await button.click();
      else {await button.focus(); await expect(button).toBeFocused(); await page.keyboard.press('Enter');}
      await expect(button).toBeDisabled();
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(action === 'Guardar' ? initial + ' H2 conservado' : initial);
      expect(await field.evaluate((node, original) => node === original, handle)).toBe(true);
      const focusBeforeTab = await page.evaluate(() => ({tag: document.activeElement?.tagName, id: document.activeElement?.id}));
      await info.attach('editor-action-focus', {body: JSON.stringify({width, note, action, modality, focusBeforeTab}), contentType: 'application/json'});
      await page.keyboard.press('Tab');
      const after = await page.evaluate(() => ({tag: document.activeElement?.tagName, id: document.activeElement?.id, hasFocus: document.hasFocus(), connected: document.activeElement?.isConnected, disabled: document.activeElement instanceof HTMLButtonElement ? document.activeElement.disabled : false}));
      await info.attach('tab-after-editor', {body: JSON.stringify({width, note, action, modality, after}), contentType: 'application/json'});
      // A nonmodal document must not trap Tab after its last mobile control.
      // Keep the observed next step diagnostic there; the restored field, node
      // and value above remain strict. Desktop has a following Time column.
      if (width === 1440) {expect(after.tag).not.toBe('BODY'); expect(after.connected).toBe(true); expect(after.disabled).toBe(false);}
      await handle?.dispose();
    });
  }
}
