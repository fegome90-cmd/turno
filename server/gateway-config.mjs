/**
 * Turno: configuración del proveedor remoto. Nunca devuelve secretos.
 * En Vercel el AI SDK usa OIDC si AI_GATEWAY_API_KEY no está configurada.
 */
const MODELS = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
const PROVIDER_SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const MODES = new Set(['GATEWAY', 'DUAL', 'DECISION']);
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high']);
// Modelo gratuito de Vercel AI Gateway que pasa la prueba estructurada.
export const DEFAULT_MODEL_ID = 'nvidia/nemotron-3.5-lightning-free';
// Modelos OpenAI con razonamiento (aceptan providerOptions.openai.reasoningEffort).
const OPENAI_REASONING = /^openai\/(gpt-5|gpt-6|o\d)/i;

function readProviderOnly(raw) {
  // Opcional: restringe el enrutamiento (p. ej. 'openai' para usar tu BYOK de
  // OpenAI y evitar failover). Vacío o '*' = sin restricción.
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '*' || value === '') return null;
  const slugs = value.split(',').map(s => s.trim()).filter(Boolean);
  if (!slugs.length || !slugs.every(s => PROVIDER_SLUG.test(s))) {
    throw new Error('TURNO_GATEWAY_ONLY inválido; usa slugs separados por coma (p. ej. openai).');
  }
  return Object.freeze(slugs);
}

export function readGatewaySettings(env = process.env) {
  const modelId = (env.TURNO_AI_MODEL_ID || DEFAULT_MODEL_ID).trim();
  const decisionModelId = (env.TURNO_DECISION_MODEL_ID || 'microsoft/microsoft-decision-1').trim();
  const decisionMode = (env.TURNO_DECISION_MODE || 'GATEWAY').trim().toUpperCase();
  if (!MODELS.test(modelId) || !MODELS.test(decisionModelId)) throw new Error('Modelo de AI Gateway inválido.');
  if (!MODES.has(decisionMode)) throw new Error('Modo de decisión inválido.');
  const providerOnly = readProviderOnly(env.TURNO_GATEWAY_ONLY);
  const reasoningEffort = (env.TURNO_AI_REASONING_EFFORT || 'low').trim().toLowerCase();
  if (!EFFORTS.has(reasoningEffort)) throw new Error('TURNO_AI_REASONING_EFFORT inválido.');
  const enabled = env.TURNO_AI_ENABLED === '1';
  if (env.TURNO_SYNTHETIC_ONLY === '0') throw new Error('El piloto no autoriza datos reales.');
  const syntheticOnly = true;
  const hasKey = typeof env.AI_GATEWAY_API_KEY === 'string' && env.AI_GATEWAY_API_KEY.trim().length > 0;
  const onVercel = env.VERCEL === '1' || ['production', 'preview', 'development'].includes(env.VERCEL_ENV);
  if (enabled && !hasKey && !onVercel && !env.VERCEL_OIDC_TOKEN) {
    throw new Error('Sin autenticación de AI Gateway en el servidor: configura AI_GATEWAY_API_KEY o despliega con OIDC en Vercel.');
  }
  return Object.freeze({ modelId, decisionModelId, decisionMode, enabled, syntheticOnly,
    providerOnly, reasoningEffort,
    authMode: hasKey ? 'api-key' : onVercel || !!env.VERCEL_OIDC_TOKEN ? 'oidc' : 'missing' });
}

/**
 * Opciones por llamada para Vercel AI Gateway (sin secretos).
 * - gateway.only: enruta solo a los proveedores permitidos (BYOK de OpenAI).
 * - gateway.tags: permite filtrar el gasto del piloto en el panel de Vercel.
 * - openai.reasoningEffort: acota tokens de razonamiento en modelos GPT-5+/o*.
 */
export function gatewayProviderOptions(settings) {
  const gateway = { tags: ['turno', 'synthetic-pilot'] };
  if (settings.providerOnly) gateway.only = [...settings.providerOnly];
  const options = { gateway };
  if (OPENAI_REASONING.test(settings.modelId)) {
    options.openai = { reasoningEffort: settings.reasoningEffort };
  }
  return options;
}

export function assertSyntheticEvent(event, settings) {
  if (!settings.enabled) throw new Error('Agente ambiental desactivado.');
  if (!event || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id || '')) throw new Error('ID de evento inválido.');
  if (event.synthetic !== true) throw new Error('Solo datos sintéticos autorizados para el piloto.');
}
