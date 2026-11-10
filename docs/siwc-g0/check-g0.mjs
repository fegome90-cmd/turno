#!/usr/bin/env node
/**
 * Static G0 asset verification only. No dependencies, no network, no model calls.
 * Passing this script DOES NOT mean the G0 gate is closed or a website published.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(resolve(dir, 'index.html'), 'utf8');
const privacy = readFileSync(resolve(dir, 'privacy.html'), 'utf8');
const stylesheet = readFileSync(resolve(dir, 'styles.css'), 'utf8');
const applicant = readFileSync(resolve(dir, 'APPLICANT-PROFILE.md'), 'utf8');
const acceptance = readFileSync(resolve(dir, 'G0-ACCEPTANCE.md'), 'utf8');
const errors = [];

function assert(condition, label) {
  if (!condition) errors.push(label);
}
function hrefs(document) {
  return [...document.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]);
}
function checkDocument(html, name) {
  assert(/<!doctype html>/i.test(html), name + ': missing doctype');
  assert(/<html\s+lang="es"/i.test(html), name + ': missing language');
  assert(/name="viewport"/.test(html), name + ': missing viewport');
  assert(!/<form\b/i.test(html), name + ': must not collect visitor inputs');
  assert(!/<script\b/i.test(html), name + ': unexpected executable script');
  assert(!/gtag\(|google-analytics|plausible\.io|posthog|segment\.com/i.test(html),
    name + ': unexpected analytics');
  for (const link of hrefs(html)) {
    if (link.startsWith('https://') || link.startsWith('mailto:')) continue;
    if (link.startsWith('#')) {
      const target = link.slice(1);
      assert(html.includes('id="' + target + '"') || html.includes("id='" + target + "'"),
        name + ': missing in-page anchor ' + link);
      continue;
    }
    assert(!link.startsWith('http://') && !link.startsWith('//') &&
      !link.startsWith('javascript:') && !link.startsWith('data:'),
      name + ': unsafe non-HTTPS URL ' + link);
    assert(existsSync(resolve(dir, link)), name + ': broken local resource ' + link);
  }
}

checkDocument(page, 'index');
checkDocument(privacy, 'privacy');
assert(/pr[oó]totipo/i.test(page), 'index: missing prototype status');
assert(/datos sint[eé]ticos/i.test(page), 'index: missing synthetic-only status');
assert(/no est[aá] disponible/i.test(page), 'index: AI features must be disclosed as unavailable');
assert(/No ingreses informaci[oó]n personal ni cl[ií]nica real/i.test(page),
  'index: missing real-data prohibition');
assert(page.includes('https://github.com/fegome90-cmd/turno'),
  'index: missing public source repository');
assert(page.includes('assets/turno-capture-review-v6-synthetic.png') && /<img\s[^>]*alt=/.test(page),
  'index: missing labelled real screenshot');
assert(/Borrador para revisi[oó]n, no pol[ií]tica vigente/i.test(privacy),
  'privacy: must remain draft');
assert(/Responsable del producto y eventual tratamiento/i.test(privacy),
  'privacy: controller field missing');
assert(/1 de diciembre de 2026/.test(privacy), 'privacy: missing future law date');
assert(/@import\s+url|https?:\/\//.test(stylesheet) === false,
  'styles: no remote CSS assets for microsite');
assert(applicant.includes('NOT CONFIRMED') && applicant.includes('NOT PUBLISHED'),
  'applicant: missing explicit owner/url blockers');
assert(acceptance.includes('PREPARED / BLOCKED_BEFORE_G1'),
  'acceptance: gate status incorrectly claims approval');

const img = readFileSync(resolve(dir, 'assets/turno-capture-review-v6-synthetic.png'));
const pngMagic = Buffer.from([137,80,78,71,13,10,26,10]);
assert(img.subarray(0,8).equals(pngMagic), 'screenshot is not a PNG');
const width = img.readUInt32BE(16), height = img.readUInt32BE(20);
assert(width === 1440 && height === 900,
  'screenshot: unexpected dimensions or corrupt header');

const result = {
  check: errors.length ? 'FAIL' : 'PASS',
  gate: 'G0_PREPARED_NOT_SUBMISSION_READY',
  networkCalls: 0,
  publishedWebsiteVerified: false,
  ownerAndContactVerified: false,
  activePrivacyPolicy: false,
  actualScreenshot: {width, height},
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
