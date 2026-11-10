const MODELS = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
const MODES = new Set(['GATEWAY','DUAL','DECISIONS']);

// Deliberately do not return the key or OIDC token. Providers read env at runtime.
export function readGatewayConfig(env=process.env) {
  if (![env.AI_GATEWAY_API_KEY,env.VERCEL_OIDC_TOKEN].some(v=>typeof v==='string' && v.trim())) {
    throw new Error('Se requiere AI_GATEWAY_API_KEY o VERCEL_OIDC_TOKEN en el backend.');
  }
  const modelId=(env.TURNO_AGENT_MODEL||'google/gemini-2.5-flash').trim();
  const decisionModelId=(env.TURNO_DECISION_MODEL||'typesafe-ai/jev').trim();
  const mode=(env.TURNO_AGENT_MODE||'GATEWAY').trim().toUpperCase();
  if (!MODELS.test(modelId)) throw new Error('TURNO_AGENT_MODEL inválido.');
  if (!MODELS.test(decisionModelId)) throw new Error('TURNO_DECISION_MODEL inválido.');
  if (!MODES.has(mode)) throw new Error('TURNO_AGENT_MODE debe ser GATEWAY, DUAL o DECISIONS.');
  return Object.freeze({modelId,decisionModelId,mode});
}
