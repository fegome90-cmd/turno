/**
 * Manual opt-in LIVE smoke for Strands + Vercel AI Gateway.
 *
 * PRE-FLIGHT (no credentials, no requests): node live-smoke.mjs --preflight
 * LIVE, macOS Keychain: node live-smoke.mjs --live --from-keychain
 * LIVE, server runtime secret: node live-smoke.mjs --live --from-env
 *
 * Does not open a port, read Turno data, or import a task writer.
 * Only a hardcoded synthetic fixture can reach the remote model.
 */
import { execFileSync } from 'node:child_process';
import { createStrandsCapture } from './gateway-capture.mjs';
import { readGatewaySettings } from './gateway-config.mjs';

export const FIXTURE = Object.freeze({
  shiftId: 'demo-shift',
  synthetic: true,
  text: 'Revisar tarea pendiente A (15:00, cama 4); Revisar tarea pendiente B (15:00, cama 4); Completar informe (antes del cierre)',
});
const BEDS = Object.freeze([
  Object.freeze({ id: 'bed-1', label: 'Cama 1' }),
  Object.freeze({ id: 'bed-2', label: 'Cama 2' }),
]);

export function secretFromKeychain() {
  if (process.platform !== 'darwin') throw new Error('La ruta Keychain requiere macOS.');
  try {
    // All arguments are identifiers, never the secret itself.
    return execFileSync('/usr/bin/security', [
      'find-generic-password', '-a', 'turno', '-s', 'turno-ai-gateway', '-w',
    ], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('No se pudo obtener el secreto de macOS Keychain. Revisa el servicio turno-ai-gateway.');
  }
}

function summarizeReview(proposals) {
  return proposals.map(p => ({
    title: p.title,
    bedLabel: p.bedLabel,
    linkedBed: Boolean(p.bedId),
    time: p.time,
    date: p.date,
    beforeClose: p.beforeClose,
    reviewFlags: p.reviewFlags,
  }));
}

export function evaluateSyntheticReview(result) {
  const proposals = result?.proposals || [];
  const byTitle = new Map(proposals.map(p => [p.title.toLowerCase().trim(), p]));
  const a = byTitle.get('revisar tarea pendiente a');
  const b = byTitle.get('revisar tarea pendiente b');
  const c = byTitle.get('completar informe');
  // El modelo conserva la grafía de la nota («cama 4»); la cama no se vincula sola.
  const bed4 = p => typeof p.bedLabel === 'string' && p.bedLabel.trim().toLowerCase() === 'cama 4';
  return Object.freeze({
    exactlyThree: proposals.length === 3,
    aCorrect: Boolean(a && a.time === '15:00' && bed4(a) && a.date === null && a.bedId === null),
    bCorrect: Boolean(b && b.time === '15:00' && bed4(b) && b.date === null && b.bedId === null),
    closeCorrect: Boolean(c && c.beforeClose && !c.time && c.date === null),
    allNeedHumanReview: proposals.length === 3 && proposals.every(p => p.status === 'requires_human_review'),
  });
}

function isRateLimit(error) {
  for (let e = error, i = 0; e && i < 5; e = e.cause, i++) {
    if (e.name === 'GatewayRateLimitError' || e.statusCode === 429) return true;
  }
  return false;
}

export function sanitizedFailure(error) {
  if (error?.message === 'No se pudo obtener el secreto de macOS Keychain. Revisa el servicio turno-ai-gateway.') return error.message;
  if (error?.message === 'La ruta Keychain requiere macOS.') return error.message;
  if (error?.message?.includes('captura') || error?.message?.includes('Captura')) return 'Fallo en la validación de propuestas; no se guardó nada.';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'Se agotó el tiempo de inferencia; no se guardó nada.';
  if (isRateLimit(error)) return 'Límite de solicitudes del modelo en AI Gateway (los modelos gratuitos admiten pocas por minuto). Espera y reintenta; no se guardó nada.';
  return 'No se completó la inferencia o el esquema estructurado. Revisa la configuración del proveedor sin imprimir credenciales ni payloads.';
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--preflight')) {
    const configuration = readGatewaySettings({
      TURNO_AI_ENABLED: '1',
      TURNO_SYNTHETIC_ONLY: '1',
      ...(process.env.TURNO_AI_MODEL_ID && { TURNO_AI_MODEL_ID: process.env.TURNO_AI_MODEL_ID }),
      AI_GATEWAY_API_KEY: 'public-preflight-placeholder-not-a-secret',
    });
    await createStrandsCapture({ env: {
      ...process.env,
      TURNO_AI_ENABLED: '1',
      TURNO_SYNTHETIC_ONLY: '1',
      AI_GATEWAY_API_KEY: 'public-preflight-placeholder-not-a-secret',
    } });
    console.log(JSON.stringify({ stage: 'preflight', modelId: configuration.modelId,
      mode: 'server-only', requests: 0, requiresKeyForLive: true, ready: true }, null, 2));
    return 0;
  }

  if (args.length !== 2 || args[0] !== '--live' || !['--from-keychain','--from-env'].includes(args[1])) {
    console.error('Uso: node live-smoke.mjs --preflight | --live --from-keychain | --live --from-env');
    return 2;
  }

  // A LIVE run requires an explicit CLI flag. The secret stays in memory.
  // No .env file, GitHub action, browser, Turno database, or public endpoint.
  let suppliedSecret;
  const fromKeychain = args[1] === '--from-keychain';
  try {
    suppliedSecret = fromKeychain ? secretFromKeychain() : process.env.AI_GATEWAY_API_KEY;
    if (fromKeychain && !suppliedSecret) throw new Error('Keychain vacío.');
    if (!suppliedSecret && !process.env.VERCEL_OIDC_TOKEN) {
      console.error('No hay credencial disponible. Crea una API key en Gateway y guárdala en Keychain o como secreto del backend.');
      return 2;
    }

    // The Gateway SDK reads process.env, but never logs this value.
    if (fromKeychain) process.env.AI_GATEWAY_API_KEY = suppliedSecret;
    const env = {
      ...process.env,
      TURNO_AI_ENABLED: '1',
      TURNO_SYNTHETIC_ONLY: '1',
      TURNO_DECISION_MODE: 'GATEWAY', // prohibit accidental dual charges
    };
    const cfg = readGatewaySettings(env);
    let metrics = null;
    const propose = await createStrandsCapture({ env, onMetrics: m => { metrics = m; } });
    const started = performance.now();
    const result = await propose(FIXTURE, {
      // Standalone local harness, not production authorization. Only FIXTURE is sent.
      isAuthorized: input => input === FIXTURE && input.synthetic === true && input.shiftId === 'demo-shift',
      beds: BEDS,
    });
    const evaluation = evaluateSyntheticReview(result);
    const passed = Object.values(evaluation).every(Boolean);
    console.log(JSON.stringify({
      stage: 'live',
      inference: 'remote',
      modelId: cfg.modelId,
      durationMs: Math.round(performance.now() - started),
      observedTokens: metrics,
      writes: 0,
      saved: false,
      review: summarizeReview(result.proposals),
      evaluation,
      verdict: passed ? 'PASS' : 'REVIEW_REQUIRED',
    }, null, 2));
    return passed ? 0 : 3;
  } catch (error) {
    console.error(sanitizedFailure(error));
    return 4;
  } finally {
    if (fromKeychain) delete process.env.AI_GATEWAY_API_KEY;
    suppliedSecret = undefined;
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const status = await main();
  process.exitCode = status;
}
