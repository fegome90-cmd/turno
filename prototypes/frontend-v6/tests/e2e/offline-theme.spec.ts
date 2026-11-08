import {test, expect, type Page, type BrowserContext} from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPngPixel} from './support/png';

// EXTRA-OFFLINE-ARTIFACT and EXTRA-PERFORMANCE-FLOWS (shell only) · 1A gate `offline-theme`.
const ARTIFACT = path.resolve('dist/preview.html');
const FIRST_PAINT_DIR = path.resolve('evidence/1A/first-paint');
const DARK_SOLID = '#f2f3f0';
const LIGHT_SOLID = '#111';
const DARK_CANVAS_RGB = [23, 24, 23]; // #171817
const LIGHT_CANVAS_RGB = [255, 255, 255]; // #fff

const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Records the paint state at each paint entry, before any app script runs, so it reflects the first painted frame.
const PAINT_OBSERVER = `
  window.__paints = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const root = document.documentElement;
        window.__paints.push({
          name: entry.name,
          theme: root.dataset.theme ?? null,
          preference: root.dataset.themePreference ?? null,
          htmlBackground: getComputedStyle(root).backgroundColor,
        });
      }
    }).observe({type: 'paint', buffered: true});
  } catch (error) {
    window.__paintsError = String(error);
  }
`;

type Probe = {
  theme: string | null;
  preference: string | null;
  solid: string;
  h1: string | null;
  buttonsInMain: number;
  inputs: number;
  storage: {local: number; session: number};
};

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      theme: root.dataset.theme ?? null,
      preference: root.dataset.themePreference ?? null,
      solid: getComputedStyle(root).getPropertyValue('--solid').trim(),
      h1: document.querySelector('h1')?.textContent ?? null,
      buttonsInMain: document.querySelectorAll('main button').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      storage: {local: window.localStorage.length, session: window.sessionStorage.length},
    };
  });
}

async function openContext(
  browser: import('@playwright/test').Browser,
  colorScheme: 'light' | 'dark',
  allowedOrigin: string | null,
) {
  const context: BrowserContext = await browser.newContext({colorScheme, serviceWorkers: 'block'});
  const external: string[] = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file:|data:|blob:)/.test(url) || (allowedOrigin && url.startsWith(allowedOrigin))) return route.continue();
    external.push(url);
    return route.abort();
  });
  await context.addInitScript(PAINT_OBSERVER);
  const page = await context.newPage();
  page.on('request', (req) => {
    const url = req.url();
    if (!/^(file:|data:|blob:)/.test(url) && !(allowedOrigin && url.startsWith(allowedOrigin))) external.push(url);
  });
  return {context, page, external};
}

for (const scheme of ['light', 'dark'] as const) {
  test(`UI-01 · TOKENS-01 · DESIGN-COMPLETE-01 · EXTRA-OFFLINE-ARTIFACT · file:// primera carga · colorScheme ${scheme}`, async ({browser}, info) => {
    const hash = sha256(ARTIFACT);
    info.annotations.push({type: 'artifact-sha256', description: hash});
    const {context, page, external} = await openContext(browser, scheme, null);
    try {
      await page.goto(pathToFileURL(ARTIFACT).href, {waitUntil: 'load'});
      await expect(page.locator('h1')).toHaveText('Hola, Demo.');
      const state = await probe(page);
      expect(state.theme).toBe(scheme);
      expect(state.preference).toBe('system');
      expect(state.solid).toBe(scheme === 'dark' ? DARK_SOLID : LIGHT_SOLID);
      expect(state.buttonsInMain).toBe(1);
      expect(state.inputs).toBe(0);
      expect(state.storage).toEqual({local: 0, session: 0});
      const paints = await page.evaluate(() => (window as unknown as {__paints: {name: string; theme: string | null; htmlBackground: string}[]}).__paints);
      expect(paints.length).toBeGreaterThan(0);
      const first = paints[0];
      expect(first.theme).toBe(scheme);
      expect(first.htmlBackground).toBe(`rgb(${(scheme === 'dark' ? DARK_CANVAS_RGB : LIGHT_CANVAS_RGB).join(', ')})`);
      info.annotations.push({type: 'first-paint', description: JSON.stringify(paints)});
      expect(external).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('DESIGN-COMPLETE-01 · EXTRA-OFFLINE-ARTIFACT · file:// cambio del sistema sin recarga; recarga vuelve a system sin persistencia', async ({browser}) => {
  const {context, page, external} = await openContext(browser, 'light', null);
  try {
    await page.goto(pathToFileURL(ARTIFACT).href, {waitUntil: 'load'});
    expect((await probe(page)).theme).toBe('light');
    await page.emulateMedia({colorScheme: 'dark'});
    await expect.poll(async () => (await probe(page)).theme).toBe('dark');
    expect((await probe(page)).preference).toBe('system');
    await page.reload({waitUntil: 'load'});
    const after = await probe(page);
    expect(after.theme).toBe('dark');
    expect(after.preference).toBe('system');
    expect(after.h1).toBe('Hola, Demo.');
    expect(after.storage).toEqual({local: 0, session: 0});
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});

test('EXTRA-OFFLINE-FIRST-PAINT · file:// primer paint y frames capturados sin destello claro', async ({browser}, info) => {
  fs.mkdirSync(FIRST_PAINT_DIR, {recursive: true});
  for (const file of fs.readdirSync(FIRST_PAINT_DIR)) fs.rmSync(path.join(FIRST_PAINT_DIR, file));
  const {context, page, external} = await openContext(browser, 'dark', null);
  const frames: {buffer: Buffer; timestamp: number}[] = [];
  try {
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', (event: {data: string; sessionId: number; metadata: {timestamp?: number}}) => {
      frames.push({buffer: Buffer.from(event.data, 'base64'), timestamp: (event.metadata.timestamp ?? 0) * 1000});
      void cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
    });
    // Protocol (orchestrator, 08/11/2026): start from a neutral dark data: document, not about:blank. Chromium keeps
    // showing the previous surface until the new document paints; a white about:blank surface held across the
    // navigation is not Turno's paint (2/10 runs with about:blank, 0/50 with a dark previous document on the same hash).
    // With a dark previous surface, any light frame can only come from the artifact, so every frame must be dark.
    await page.goto('data:text/html,<html style="background:%23171817"></html>', {waitUntil: 'load'});
    await cdp.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
    await page.goto(pathToFileURL(ARTIFACT).href, {waitUntil: 'commit'});
    await expect(page.locator('h1')).toHaveText('Hola, Demo.');
    await page.waitForTimeout(400);
    await cdp.send('Page.stopScreencast');
    expect(frames.length).toBeGreaterThan(0);
    const samples = frames.map((frame, index) => {
      fs.writeFileSync(path.join(FIRST_PAINT_DIR, `frame-${String(index).padStart(3, '0')}.png`), frame.buffer);
      const pixel = readPngPixel(frame.buffer, 2, 2);
      return {index, r: pixel.r, g: pixel.g, b: pixel.b, width: pixel.width, height: pixel.height};
    });
    fs.writeFileSync(path.join(FIRST_PAINT_DIR, 'samples.json'), JSON.stringify(samples, null, 2));
    info.annotations.push({type: 'frames', description: `${frames.length} frames ${JSON.stringify(samples.map((x) => [x.r, x.g, x.b]))}`});
    // No light flash: every captured frame is dark, and the last one is exactly the token canvas.
    for (const sample of samples) expect(Math.max(sample.r, sample.g, sample.b)).toBeLessThanOrEqual(64);
    expect([samples.at(-1)!.r, samples.at(-1)!.g, samples.at(-1)!.b]).toEqual(DARK_CANVAS_RGB);
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});

test('EXTRA-OFFLINE-ARTIFACT · HTTP local disponible, orígenes externos bloqueados; recarga vuelve a system', async ({browser}) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/preview.html' || req.url === '/') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      res.end(fs.readFileSync(ARTIFACT));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no local port');
  const origin = `http://127.0.0.1:${address.port}`;
  const {context, page, external} = await openContext(browser, 'light', origin);
  try {
    await page.goto(`${origin}/preview.html`, {waitUntil: 'load'});
    await expect(page.locator('h1')).toHaveText('Hola, Demo.');
    expect((await probe(page)).theme).toBe('light');
    await page.emulateMedia({colorScheme: 'dark'});
    await expect.poll(async () => (await probe(page)).theme).toBe('dark');
    await page.reload({waitUntil: 'load'});
    const after = await probe(page);
    expect(after.theme).toBe('dark');
    expect(after.preference).toBe('system');
    expect(after.storage).toEqual({local: 0, session: 0});
    expect(external).toEqual([]);
  } finally {
    await context.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
