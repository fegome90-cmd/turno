// Repeats the screencast first-paint capture N times (dark system, file://) and keeps every run, pass or fail.
// Evidence only: it does not replace the gate in tests/e2e/offline-theme.spec.ts and applies no threshold of its own.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
import {readPngPixel} from '../tests/e2e/support/png.ts';

const RUNS = Number(process.env.FP_RUNS ?? 10);
const OUT = path.resolve(process.env.FP_OUT ?? 'evidence/1A/first-paint-repeat');
const ARTIFACT = path.resolve(process.env.FP_FILE ?? 'dist/preview.html');
const APP_CANVAS = [23, 24, 23];
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', headless: true});
const runs = [];
try {
  for (let run = 1; run <= RUNS; run++) {
    const dir = path.join(OUT, `run-${String(run).padStart(2, '0')}`);
    fs.mkdirSync(dir, {recursive: true});
    const context = await browser.newContext({colorScheme: 'dark', serviceWorkers: 'block'});
    await context.route('**/*', (route) => (/^(file:|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', (event) => {
      frames.push({buffer: Buffer.from(event.data, 'base64'), timestamp: (event.metadata.timestamp ?? 0) * 1000});
      void cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
    });
    await cdp.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
    // FP_PREV=dark: first load a dark neutral document, so the previous surface is not the blank about:blank.
    if (process.env.FP_PREV === 'dark') {
      await page.goto('data:text/html,<html style="background:%23171817"></html>', {waitUntil: 'load'});
    }
    frames.length = 0;
    await page.goto(pathToFileURL(ARTIFACT).href, {waitUntil: 'commit'});
    const committedAt = Date.now();
    await page.locator('h1').waitFor({state: 'visible', timeout: 15_000});
    await page.waitForTimeout(400);
    await cdp.send('Page.stopScreencast');
    const samples = frames.map((frame, index) => {
      fs.writeFileSync(path.join(dir, `frame-${String(index).padStart(3, '0')}.png`), frame.buffer);
      const pixel = readPngPixel(frame.buffer, 2, 2);
      return {index, phase: frame.timestamp >= committedAt ? 'after-commit' : 'pre-commit', rgb: [pixel.r, pixel.g, pixel.b]};
    });
    const after = samples.filter((s) => s.phase === 'after-commit');
    runs.push({
      run,
      preCommitFrames: samples.length - after.length,
      afterCommit: after.map((s) => s.rgb),
      noLightFrameAfterCommit: after.every((s) => Math.max(...s.rgb) <= 64),
      strictFirstAfterCommitIsAppCanvas: after.length > 0 && after[0].rgb.every((v, i) => v === APP_CANVAS[i]),
      lastIsAppCanvas: after.length > 0 && after.at(-1).rgb.every((v, i) => v === APP_CANVAS[i]),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
const summary = {
  runs: RUNS,
  noLightFrameAfterCommit: runs.filter((r) => r.noLightFrameAfterCommit).length,
  strictFirstAfterCommitIsAppCanvas: runs.filter((r) => r.strictFirstAfterCommitIsAppCanvas).length,
  lastIsAppCanvas: runs.filter((r) => r.lastIsAppCanvas).length,
};
console.log(JSON.stringify({artifact: 'dist/preview.html', summary, runs, note: 'Evidencia repetida sin umbral propio. Cada corrida se conserva, aprobada o no.'}, null, 2));
