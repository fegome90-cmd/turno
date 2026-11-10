// Portability check for the single-file artifact.
// 1) Static: no external src/href attributes, CSS url() or module imports in the HTML markup, styles or script imports.
// 2) Runtime (Chromium, file://): every request must be file:, data: or blob:; no console errors, page errors or failed requests.
// A regex alone is not evidence of execution: the runtime part is the gate. Output is JSON on stdout; exit 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const target = process.argv[2] ?? 'dist/preview.html';
const abs = path.resolve(target);
const html = fs.readFileSync(abs, 'utf8');
const failures = [];
const isLocal = (value) => /^(data:|blob:|#|file:)/i.test(value.trim()) || value.trim() === '';

// Strip script and style bodies to inspect markup attributes separately.
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
for (const m of markup.matchAll(/\b(src|href|srcset|poster|data)\s*=\s*"([^"]*)"/gi)) {
  if (!isLocal(m[2])) failures.push({kind: 'static-attribute', attribute: m[1], value: m[2].slice(0, 120)});
}
for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
  for (const u of m[1].matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g)) {
    if (!isLocal(u[2])) failures.push({kind: 'static-css-url', value: u[2].slice(0, 120)});
  }
  if (/@import\b/.test(m[1])) failures.push({kind: 'static-css-import'});
}
for (const m of html.matchAll(/(?:import\s*\(\s*|\bimport\s+|\bfrom\s*)(['"])(https?:\/\/|\/\/)[^'"]*\1/g)) {
  failures.push({kind: 'static-module-import', value: m[0].slice(0, 120)});
}
const staticFailures = failures.length;

// Runtime check in Chromium with no network: only file/data/blob may load.
const external = [];
const consoleErrors = [];
const pageErrors = [];
const failed = [];
const browser = await chromium.launch({executablePath: "/Users/felipe_gonzalez/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", headless: true});
let report;
try {
  const context = await browser.newContext({serviceWorkers: 'block', offline: false});
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file:|data:|blob:)/i.test(url)) return route.continue();
    external.push(url.slice(0, 160));
    return route.abort();
  });
  const page = await context.newPage();
  page.on('request', (req) => {
    if (!/^(file:|data:|blob:)/i.test(req.url())) external.push(req.url().slice(0, 160));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 200)));
  page.on('requestfailed', (req) => failed.push(req.url().slice(0, 160)));
  await page.goto(pathToFileURL(abs).href, {waitUntil: 'load'});
  await page.waitForSelector('h1', {state: 'visible', timeout: 10_000});
  await page.waitForTimeout(300);
  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`);
    return {h1: document.querySelector('h1')?.textContent ?? null, fontsLoaded: loaded, theme: document.documentElement.dataset.theme ?? null};
  });
  report = {runtime: info};
} finally {
  await browser.close();
}
for (const url of external) failures.push({kind: 'runtime-request', url});
for (const message of consoleErrors) failures.push({kind: 'console', message});
for (const message of pageErrors) failures.push({kind: 'page-error', message});
for (const url of failed) failures.push({kind: 'request-failed', url});
if (!report.runtime.h1) failures.push({kind: 'runtime-no-h1'});
if (report.runtime.fontsLoaded.length === 0) failures.push({kind: 'runtime-no-font-loaded'});

const result = {
  file: target,
  bytes: fs.statSync(abs).size,
  staticFailures,
  runtime: report.runtime,
  externalRequests: external.length,
  consoleErrors: consoleErrors.length,
  pageErrors: pageErrors.length,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
