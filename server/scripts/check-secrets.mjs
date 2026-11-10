#!/usr/bin/env node
/**
 * Resguardo mínimo contra secretos en el repositorio. Sin dependencias ni red.
 *
 *   node scripts/check-secrets.mjs            # archivos versionados (CI, npm test)
 *   node scripts/check-secrets.mjs --staged   # lo que está por entrar al commit (pre-commit)
 *
 * Falla (código 1) si encuentra:
 *  - un archivo de entorno real (.env, .env.local, …): solo se permite .env.example;
 *  - en .env.example, una variable de credencial con valor;
 *  - texto con forma de clave conocida (OpenAI, Anthropic, Vercel, AWS, Google, GitHub,
 *    Slack, claves privadas, tokens Bearer) o una asignación *_API_KEY / *_TOKEN / *_SECRET
 *    con valor literal.
 * Nunca imprime el valor encontrado: solo el archivo, la línea y el tipo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SECRET_PATTERNS = Object.freeze([
  ['clave de OpenAI', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ['clave de Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['clave de Vercel', /\bvc[kp]_[A-Za-z0-9]{20,}/],
  ['clave de AWS', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['clave de Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['token de Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['token Bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{30,}={0,2}/],
  // NOMBRE_API_KEY=valor / "apiKey": "valor" con un valor literal largo (no variables ni relleno).
  ['credencial asignada', /\b[A-Z0-9_]*(?:API_KEY|_TOKEN|_SECRET|PASSWORD)\s*[=:]\s*["']?(?![$<{]|process\.env)[A-Za-z0-9._~+/-]{16,}/],
  ['credencial asignada', /["'](?:api[_-]?key|access[_-]?token|secret|password|client[_-]?secret)["']\s*:\s*["'][A-Za-z0-9._~+/-]{16,}["']/i],
]);

// Valores de prueba que el repositorio usa a propósito; nunca son credenciales.
const ALLOWED_VALUES = /placeholder-not-a-secret|secret-synthetic-test-key|proxy-injected/;
const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
const ENV_EXAMPLE = /(^|\/)\.env\.example$/;
const SKIP_FILE = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|heic|zip))$/i;
const CREDENTIAL_VARS = /^\s*([A-Z0-9_]*(?:API_KEY|_TOKEN|_SECRET|PASSWORD|ACCESS_KEY_ID|SECRET_ACCESS_KEY))\s*=\s*(\S+)/;

/** Replaces key-shaped strings and URLs (which may carry tokens or account ids) before storing text. */
export function redactSecrets(text) {
  let out = String(text ?? '');
  for (const [, re] of SECRET_PATTERNS) out = out.replace(new RegExp(re.source, 'g'), '[redactado]');
  return out.replace(/https?:\/\/[^\s"')]+/g, '[url]');
}

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listFiles(root, staged) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z'];
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
}

function readContent(root, file, staged) {
  if (staged) return execFileSync('git', ['show', ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 20e6 });
  return readFileSync(join(root, file), 'utf8');
}

/** Pure check over one file's path and text; returns findings without the secret value. */
export function scanText(file, text) {
  const findings = [];
  if (ENV_FILE.test(file) && !ENV_EXAMPLE.test(file)) {
    findings.push({ file, line: 0, kind: 'archivo de entorno real versionado (solo se permite .env.example)' });
    return findings;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (ENV_EXAMPLE.test(file)) {
      const m = line.match(CREDENTIAL_VARS);
      if (m) findings.push({ file, line: i + 1, kind: `${m[1]} con valor en .env.example (debe quedar vacía)` });
    }
    if (ALLOWED_VALUES.test(line)) return;
    for (const [kind, re] of SECRET_PATTERNS) {
      if (re.test(line)) { findings.push({ file, line: i + 1, kind }); break; }
    }
  });
  return findings;
}

export function scanRepo({ staged = false } = {}) {
  const root = repoRoot();
  const findings = [];
  for (const file of listFiles(root, staged)) {
    if (SKIP_FILE.test(file)) continue;
    let text;
    try { text = readContent(root, file, staged); } catch { continue; }
    if (text.includes('\0')) continue; // binario
    findings.push(...scanText(file, text));
  }
  return findings;
}

export function main(args = process.argv.slice(2)) {
  const staged = args.includes('--staged');
  const findings = scanRepo({ staged });
  if (!findings.length) {
    console.log(`Sin secretos en ${staged ? 'los cambios preparados' : 'los archivos versionados'}.`);
    return 0;
  }
  console.error('Posibles secretos (no se muestran los valores):');
  for (const f of findings) console.error(`  ${f.file}${f.line ? ':' + f.line : ''}  ${f.kind}`);
  console.error('Quita el secreto del archivo, guárdalo en el gestor de secretos o en el Llavero, y si ya se subió, revócalo.');
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
