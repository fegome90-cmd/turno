import {test, expect, type Page} from '@playwright/test';
import {createServer, type Server} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {allowHistoryHarnessRequest} from './support/history-request-policy';

// G2B technical harness only. Does not mark HISTORY-01–09 integrated or certify host ChatGPT.
// Build first: node scripts/build-history-harness.mjs
const artifact = resolve('dist-history/history-harness.html');
let server: Server;
let httpUrl: string;
const failures = new WeakMap<Page, string[]>();
const externalRequests = new WeakMap<Page, string[]>();
const expectedBlockedRequests = new WeakMap<Page, string[]>();
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
  expect(externalRequests.get(page) ?? []).toEqual(expectedBlockedRequests.get(page) ?? []);
});

const index = (page: Page) => page.evaluate(() => window.history.state?.idx as number | undefined);
const length = (page: Page) => page.evaluate(() => window.history.length);
declare global {
  interface Window {__historyDelivery: {held: boolean; pending: (() => void)[]; release(): void}}
}
async function delayedDelivery(page: Page) {
  // Real browser traversal with deliberately delayed adapter delivery, to reproduce stale-event races.
  // This is test-only transport instrumentation, not a replacement for history.go or product evidence.
  await page.addInitScript(() => {
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    const wrappers = new Map<EventListenerOrEventListenerObject, EventListener>();
    const active = new Set<EventListener>();
    const delivery = {held: false, pending: [] as (() => void)[], release() {
      this.held = false;
      for (const callback of this.pending.splice(0)) callback();
    }};
    window.__historyDelivery = delivery;
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (!listener) return;
      if (type !== 'popstate') { add(type, listener, options); return; }
      const wrapped: EventListener = (event) => {
        const invoke = () => {
          if (!active.has(wrapped)) return;
          if (typeof listener === 'function') listener.call(window, event); else listener.handleEvent(event);
        };
        if (delivery.held) delivery.pending.push(invoke); else invoke();
      };
      wrappers.set(listener, wrapped); active.add(wrapped); add(type, wrapped, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
      if (!listener) return;
      const wrapped = wrappers.get(listener);
      if (type === 'popstate' && wrapped) { active.delete(wrapped); wrappers.delete(listener); remove(type, wrapped, options); }
      else remove(type, listener, options);
    }) as typeof window.removeEventListener;
  });
  await page.reload();
  await expect.poll(() => index(page)).toBe(0);
}
const holdDelivery = (page: Page) => page.evaluate(() => { window.__historyDelivery.held = true; });
const releaseDelivery = (page: Page) => page.evaluate(() => { window.__historyDelivery.release(); });
async function waitForHeldMove(page: Page, target: number) {
  await expect.poll(() => index(page)).toBe(target);
  await expect.poll(() => page.evaluate(() => window.__historyDelivery.pending.length)).toBeGreaterThan(0);
}
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
      const documentUrl = protocol === 'file' ? pathToFileURL(artifact).href : httpUrl;
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (allowHistoryHarnessRequest(url, documentUrl)) return route.continue();
        requests.push(url); return route.abort();
      });
      await page.goto(documentUrl);
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

    test('negative control: external request is intercepted and aborted while the local document stays usable', async ({page}) => {
      const blocked = 'https://blocked.invalid/turno-history-probe';
      expectedBlockedRequests.set(page, [blocked]);
      const failed = page.waitForEvent('requestfailed', {predicate: (request) => request.url() === blocked});
      const rejected = await page.evaluate(async (url) => {
        try { await fetch(url); return false; } catch { return true; }
      }, blocked);
      expect(rejected).toBe(true);
      expect((await failed).failure()?.errorText).toBeTruthy();
      expect(externalRequests.get(page)).toEqual([blocked]);
      await expect(page.getByRole('heading', {name: 'Historial y guardas · harness técnico 2B'})).toBeVisible();
      await expect(page).toHaveTitle('Inicio · Turno');
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

    test('new selection during approved replay survives delayed old popstate and branches from the visible source', async ({page}) => {
      await delayedDelivery(page); await middle(page);
      await page.getByRole('textbox', {name: 'Borrador'}).fill('A guardar');
      await traverse(page, -1); await expect.poll(() => index(page)).toBe(1);
      await page.getByRole('button', {name: 'Guardar y continuar'}).click();
      await holdDelivery(page);
      await page.getByRole('button', {name: 'Resolver éxito'}).click();
      await waitForHeldMove(page, 0);
      await page.getByRole('button', {name: 'Tarea 2', exact: true}).click();
      await expect(page.getByTestId('route')).toHaveText('workspace:task-1');
      await releaseDelivery(page);
      await expect(page.getByTestId('route')).toHaveText('workspace:task-2');
      await expect(page).toHaveTitle('Revisar insumos · Turno'); expect(await index(page)).toBe(2);
      await traverse(page, -1); await expect(page).toHaveTitle('Tarea 1 · Turno');
    });

    test('new selection before user popstate delivery cannot be overwritten by the queued route', async ({page}) => {
      await delayedDelivery(page); await middle(page); await holdDelivery(page);
      await page.evaluate(() => history.go(-1)); await waitForHeldMove(page, 0);
      await page.getByRole('button', {name: 'Tarea 2', exact: true}).click();
      await waitForHeldMove(page, 1); await releaseDelivery(page);
      await expect(page.getByTestId('route')).toHaveText('workspace:task-2');
      await expect(page).toHaveTitle('Revisar insumos · Turno'); expect(await index(page)).toBe(2);
      await traverse(page, -1); await expect(page).toHaveTitle('Tarea 1 · Turno');
    });
  });
}
