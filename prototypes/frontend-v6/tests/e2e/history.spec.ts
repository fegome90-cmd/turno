import {test, expect, type Page} from '@playwright/test';
import {createServer, type Server} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// G2B technical harness only. Does not mark HISTORY-01–09 integrated or certify host ChatGPT.
// Build first: node scripts/build-history-harness.mjs
const artifact = resolve('dist-history/history-harness.html');
let server: Server;
let httpUrl: string;
const failures = new WeakMap<Page, string[]>();
const externalRequests = new WeakMap<Page, string[]>();
test.beforeAll(async () => {
  const html = await readFile(artifact);
  server = createServer((_req, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing harness port');
  httpUrl = `http://127.0.0.1:${address.port}/history-harness.html`;
});
test.afterAll(async () => { if (server) await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done())); });
test.afterEach(({page}) => {
  expect(failures.get(page) ?? []).toEqual([]);
  expect(externalRequests.get(page) ?? []).toEqual([]);
});

const index = (page: Page) => page.evaluate(() => window.history.state?.idx as number | undefined);
const length = (page: Page) => page.evaluate(() => window.history.length);
async function traverse(page: Page, delta: number) {
  // Wait for a real popstate, rather than asserting an unchanged route before traversal begins.
  await page.evaluate((move) => new Promise<void>((done) => {
    window.addEventListener('popstate', () => { setTimeout(done, 0); }, {once: true});
    window.history.go(move);
  }), delta);
}
async function middle(page: Page) {
  await page.getByRole('button', {name: 'Tarea 1', exact: true}).click();
  await page.getByRole('button', {name: 'Tarea 2', exact: true}).click();
  await traverse(page, -1);
  await expect(page.getByTestId('route')).toHaveText('workspace:task-1');
  await expect.poll(() => index(page)).toBe(1);
}

for (const protocol of ['file', 'http'] as const) {
  test.describe(`G2B · ${protocol} · controller harness`, () => {
    test.beforeEach(async ({page, context}) => {
      const errors: string[] = []; const requests: string[] = [];
      failures.set(page, errors); externalRequests.set(page, requests);
      page.on('pageerror', (error) => errors.push(error.message));
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('http://127.0.0.1:')) return route.continue();
        requests.push(url); return route.abort();
      });
      await page.goto(protocol === 'file' ? pathToFileURL(artifact).href : httpUrl);
      await expect(page.getByRole('heading', {name: 'Historial y guardas · harness técnico 2B'})).toBeVisible();
      await expect.poll(() => index(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('initial replace, distinct route push, title, rerender and Back/Forward restore without URL changes', async ({page}) => {
      const url = page.url(); const initialLength = await length(page);
      await expect(page).toHaveTitle('Inicio · Turno');
      await page.getByRole('button', {name: 'Tarea 1', exact: true}).click();
      await expect(page).toHaveTitle('Tarea 1 · Turno');
      await page.getByRole('button', {name: 'Render sin navegar'}).click();
      await page.getByRole('button', {name: 'Tarea 1', exact: true}).click();
      expect(await length(page)).toBe(initialLength + 1);
      await traverse(page, -1); await expect(page).toHaveTitle('Inicio · Turno');
      await traverse(page, 1); await expect(page).toHaveTitle('Tarea 1 · Turno');
      expect(page.url()).toBe(url); expect(await length(page)).toBe(initialLength + 1);
    });

    test('overlay Back returns to the same entry, restores visible focus, and retains Forward', async ({page}) => {
      await middle(page); const size = await length(page);
      await page.getByRole('button', {name: 'Más opciones de prueba'}).click();
      await expect(page.getByRole('dialog', {name: 'Opciones de prueba'})).toBeVisible();
      await traverse(page, -1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(() => index(page)).toBe(1);
      await expect(page.getByRole('button', {name: 'Más opciones de prueba'})).toBeFocused();
      expect(await length(page)).toBe(size);
      await traverse(page, 1); await expect(page).toHaveTitle('Revisar insumos · Turno');
    });

    test('busy blocks traversal without truncating Forward', async ({page}) => {
      await middle(page); const size = await length(page);
      await page.getByRole('button', {name: 'Alternar busy'}).click();
      await traverse(page, -1); await expect.poll(() => index(page)).toBe(1);
      await expect(page.getByTestId('route')).toHaveText('workspace:task-1');
      expect(await length(page)).toBe(size);
      await page.getByRole('button', {name: 'Alternar busy'}).click();
      await traverse(page, 1); await expect(page).toHaveTitle('Revisar insumos · Turno');
    });

    for (const direction of [-1, 1]) {
      test(`cancel and discard repeat original delta ${direction} once`, async ({page}) => {
        await middle(page); const size = await length(page);
        await page.getByRole('textbox', {name: 'Borrador'}).fill('Sin guardar  31/02/2026');
        await traverse(page, direction); await expect.poll(() => index(page)).toBe(1);
        await expect(page.getByRole('dialog', {name: 'Cambios sin guardar'})).toBeVisible();
        await page.getByRole('button', {name: 'Volver', exact: true}).click();
        await expect(page.getByRole('textbox', {name: 'Borrador'})).toHaveValue('Sin guardar  31/02/2026');
        await expect(page.getByRole('textbox', {name: 'Borrador'})).toBeFocused();
        await traverse(page, direction); await expect.poll(() => index(page)).toBe(1);
        await page.getByRole('button', {name: 'Descartar', exact: true}).click();
        await expect.poll(() => index(page)).toBe(1 + direction);
        await expect(page).toHaveTitle(direction < 0 ? 'Inicio · Turno' : 'Revisar insumos · Turno');
        expect(await length(page)).toBe(size);
      });
    }

    test('failed save preserves draft and route; retry success continues original Forward once', async ({page}) => {
      await middle(page); const size = await length(page);
      await page.getByRole('textbox', {name: 'Borrador'}).fill('Texto exacto  ');
      await traverse(page, 1); await expect.poll(() => index(page)).toBe(1);
      await page.getByRole('button', {name: 'Guardar y continuar'}).click();
      await page.getByRole('button', {name: 'Resolver fallo'}).click();
      await expect(page.getByRole('alert')).toContainText('Fallo simulado');
      await expect(page.locator('textarea')).toHaveValue('Texto exacto  ');
      expect(await index(page)).toBe(1);
      await page.getByRole('button', {name: 'Guardar y continuar'}).click();
      await page.getByRole('button', {name: 'Resolver éxito'}).click();
      await expect.poll(() => index(page)).toBe(2);
      await expect(page).toHaveTitle('Revisar insumos · Turno'); expect(await length(page)).toBe(size);
    });

    test('EXTRA-LIFECYCLE-ASYNC · late response cannot navigate or steal focus from a newer selection', async ({page}) => {
      await middle(page);
      await page.getByRole('textbox', {name: 'Borrador'}).fill('Viejo');
      await traverse(page, -1); await expect.poll(() => index(page)).toBe(1);
      await page.getByRole('button', {name: 'Guardar y continuar'}).click();
      await page.getByRole('button', {name: 'Volver', exact: true}).click();
      await page.getByRole('button', {name: 'Tarea 2', exact: true}).click();
      await page.getByRole('button', {name: 'Descartar', exact: true}).click();
      await expect(page.getByTestId('route')).toHaveText('workspace:task-2');
      await page.getByRole('textbox', {name: 'Borrador'}).fill('Más reciente');
      // Resolve programmatically so the resolver button itself cannot move focus.
      await page.getByRole('button', {name: 'Resolver respuesta antigua'}).evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.getByRole('textbox', {name: 'Borrador'})).toBeFocused();
      await expect(page.getByRole('textbox', {name: 'Borrador'})).toHaveValue('Más reciente');
      await expect(page).toHaveTitle('Revisar insumos · Turno');
    });

    test('cancel during save invalidates its eventual success without another navigation', async ({page}) => {
      await middle(page);
      await page.getByRole('textbox', {name: 'Borrador'}).fill('Conservar');
      await traverse(page, -1); await expect.poll(() => index(page)).toBe(1);
      await page.getByRole('button', {name: 'Guardar y continuar'}).click();
      await page.getByRole('button', {name: 'Volver', exact: true}).click();
      await page.getByRole('button', {name: 'Resolver respuesta antigua'}).evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.getByTestId('route')).toHaveText('workspace:task-1');
      expect(await index(page)).toBe(1);
      await expect(page.getByRole('textbox', {name: 'Borrador'})).toHaveValue('Conservar');
      await expect(page.getByRole('textbox', {name: 'Borrador'})).toBeFocused();
    });

    test('foreign entries without owned idx stay external and are not replaced or bounced', async ({page}) => {
      await page.getByRole('button', {name: 'Tarea 1', exact: true}).click();
      const size = await length(page);
      await page.evaluate(() => { history.pushState({hostKey: 'outside'}, ''); history.pushState({hostKey: 'later'}, ''); });
      await traverse(page, -1);
      expect(await page.evaluate(() => history.state)).toEqual({hostKey: 'outside'});
      await expect(page.getByTestId('route')).toHaveText('workspace:task-1');
      expect(await length(page)).toBe(size + 2);
      await traverse(page, 1);
      expect(await page.evaluate(() => history.state)).toEqual({hostKey: 'later'});
    });
  });
}
