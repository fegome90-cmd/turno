import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, scanRepo, redactSecrets } from '../scripts/check-secrets.mjs';
import { errorDetail } from '../eval/run-eval.mjs';

// Claves falsas armadas en tiempo de ejecución: este archivo no contiene ninguna literal.
const fake = (prefix, n = 40) => prefix + 'A1b2C3d4'.repeat(Math.ceil(n / 8)).slice(0, n);

test('el repositorio no tiene archivos de entorno reales ni secretos versionados', () => {
  const findings = scanRepo();
  assert.deepEqual(findings.map(f => `${f.file}:${f.line} ${f.kind}`), []);
});

test('detecta archivos de entorno reales; .env.example se permite', () => {
  assert.equal(scanText('server/.env', 'TURNO_AI_ENABLED=0').length, 1);
  assert.equal(scanText('.env.local', '').length, 1);
  assert.equal(scanText('server/.env.production', '').length, 1);
  assert.deepEqual(scanText('server/.env.example', 'TURNO_AI_ENABLED=0\nAI_GATEWAY_API_KEY=\n'), []);
});

test('en .env.example las variables de credencial deben quedar vacías', () => {
  const f = scanText('server/.env.example', 'AI_GATEWAY_API_KEY=algo-que-no-va\n');
  assert.equal(f.length, 1);
  assert.match(f[0].kind, /AI_GATEWAY_API_KEY con valor/);
});

test('detecta claves con formato conocido sin mostrar su valor', () => {
  const samples = {
    'clave de OpenAI': fake('sk-proj-'),
    'clave de Anthropic': fake('sk-ant-api03-'),
    'clave de Vercel': fake('vck_'),
    'clave de AWS': 'AKIA' + 'ABCDEFGHIJKLMNOP',
    'clave de Google': fake('AIza', 35),
    'token de GitHub': fake('ghp_', 36),
    'token Bearer': 'Authorization: Bearer ' + fake('', 40),
    'credencial asignada': 'OPENAI_API_KEY=' + fake('', 24),
  };
  for (const [kind, value] of Object.entries(samples)) {
    const f = scanText('src/app.mjs', `const x = "${value}";`);
    assert.equal(f.length, 1, kind);
    assert.equal(JSON.stringify(f).includes(value), false, 'no debe repetir el secreto');
  }
  assert.equal(scanText('k.pem', '-----BEGIN ' + 'RSA PRIVATE KEY-----').length, 1);
});

test('no marca referencias a variables ni valores de prueba conocidos', () => {
  const ok = [
    'const key = process.env.AI_GATEWAY_API_KEY;',
    'AI_GATEWAY_API_KEY=${{ secrets.AI_GATEWAY_API_KEY }}',
    "AI_GATEWAY_API_KEY: 'public-preflight-placeholder-not-a-secret',",
    'curl -H "Authorization: Bearer proxy-injected"',
    'apiKey: key,',
  ];
  for (const line of ok) assert.deepEqual(scanText('src/a.mjs', line), [], line);
});

test('los errores que guarda la evaluación no llevan claves ni URLs', () => {
  const key = fake('sk-proj-');
  const err = new Error('stream', { cause: new Error(`Unauthorized for ${key} see https://vercel.com/d?to=/team_x/ai`) });
  const detail = errorDetail(err);
  assert.equal(detail.includes(key), false);
  assert.equal(detail.includes('vercel.com'), false);
  assert.match(detail, /\[redactado\]/);
  assert.match(detail, /\[url\]/);
  assert.equal(redactSecrets('sin secretos'), 'sin secretos');
});
