// Informational cold-load sampler for the shell (EXTRA-PERFORMANCE-FLOWS, 1A only).
// Interleaves v6 and v5 samples; each sample uses a fresh browser context. No pass/fail threshold here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const SAMPLES = Number(process.env.PERF_SAMPLES ?? 20);
const VIEWPORT = {width: 1280, height: 720};
const targets = {
  v6: path.resolve('dist/preview.html'),
  v5: path.resolve('../frontend-v5/preview.html'),
};
for (const [key, file] of Object.entries(targets)) {
  if (!fs.existsSync(file)) throw new Error(`falta el artefacto ${key}: ${file}`);
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)].toFixed(1));
};
const summary = (values) => ({
  n: values.length,
  min: percentile(values, 0.0001),
  p50: percentile(values, 50),
  p95: percentile(values, 95),
  max: percentile(values, 100),
});

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', headless: true});
const samples = {v6: [], v5: []};
try {
  for (let i = 0; i < SAMPLES; i++) {
    const order = i % 2 === 0 ? ['v6', 'v5'] : ['v5', 'v6'];
    for (const key of order) {
      const context = await browser.newContext({colorScheme: 'light', viewport: VIEWPORT, serviceWorkers: 'block'});
      await context.route('**/*', (route) =>
        /^(file:|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      const start = performance.now();
      await page.goto(pathToFileURL(targets[key]).href, {waitUntil: 'commit'});
      await page.locator('h1').waitFor({state: 'visible', timeout: 15_000});
      samples[key].push(performance.now() - start);
      await context.close();
    }
  }
  const result = {
    criterion: 'Informativo, sin umbral de aprobación en 1A (fijado antes de medir). Cold load file://, h1 visible, 20 muestras alternadas por producto, un worker.',
    observedAt: new Date().toISOString(),
    browserVersion: browser.version(),
    node: process.version,
    viewport: VIEWPORT,
    colorScheme: 'light',
    artifacts: {
      v6: {file: 'dist/preview.html', sha256: sha256(targets.v6), bytes: fs.statSync(targets.v6).size},
      v5: {file: '../frontend-v5/preview.html', sha256: sha256(targets.v5), bytes: fs.statSync(targets.v5).size},
    },
    ms: {v6: summary(samples.v6), v5: summary(samples.v5)},
    ratio: {
      p50_v6_over_v5: Number((percentile(samples.v6, 50) / percentile(samples.v5, 50)).toFixed(3)),
      p95_v6_over_v5: Number((percentile(samples.v6, 95) / percentile(samples.v5, 95)).toFixed(3)),
    },
    samples: {v6: samples.v6.map((x) => Number(x.toFixed(1))), v5: samples.v5.map((x) => Number(x.toFixed(1)))},
    status: 'INFORMATIVO',
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
