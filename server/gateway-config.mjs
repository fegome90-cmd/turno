/**
 * Turno: configuración del proveedor remoto. Nunca devuelve secretos.
 * Proveedores de Strands Agents: ver model-providers.mjs. Por defecto Vercel AI
 * Gateway; en Vercel el AI SDK usa OIDC si AI_GATEWAY_API_KEY no está configurada.
 */
import { PROVIDERS, PROVIDER_NAMES, presentKeyEnv, hasAwsChain, isOpenAIReasoningModel } from './model-providers.mjs';

const GATEWAY_MODEL = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
// Ids de otros proveedores: «gpt-5-mini», «accounts/x/models/y», «global.anthropic...:0».
const GENERIC_MODEL = /^[a-z0-9][a-z0-9._:/@-]{0,159}$/i;
const PROVIDER_SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const MODES = new Set(['GATEWAY', 'DUAL', 'DECISION']);
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high']);
const REGION = /^[a-z]{2}(-[a-z]+)+-\d$/;
export const DEFAULT_PROVIDER = 'vercel';
export const DEFAULT_MODEL_ID = PROVIDERS.vercel.defaultModel;
// Respaldo si el principal falla o no está disponible (Gateway: providerOptions.gateway.models).
// DeepSeek v4.1 Flash también tuvo 100 % en la evaluación; va por la clave BYOK de DeepSeek.
export const DEFAULT_FALLBACK_MODELS = Object.freeze(['deepseek/deepseek-v4.1-flash']);
// Decider del sistema de Strands/Amazon. Umbral 0: en la corrida DUAL las respuestas de baja
// confianza de Jev eran correctas y el umbral 0,90 solo lo hacía abstenerse (eval/results/*.dual.json).
export const DEFAULT_DECISION_MODEL_ID = 'typesafe-ai/jev';
export const DEFAULT_DECISION_MIN_CONFIDENCE = 0;

function readProviderOnly(raw) {
  // Opcional (solo Vercel): restringe el enrutamiento (p. ej. 'openai' para usar
  // tu BYOK de OpenAI y evitar failover). Vacío o '*' = sin restricción.
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '*' || value === '') return null;
  const slugs = value.split(',').map(s => s.trim()).filter(Boolean);
  if (!slugs.length || !slugs.every(s => PROVIDER_SLUG.test(s))) {
    throw new Error('TURNO_GATEWAY_ONLY inválido; usa slugs separados por coma (p. ej. openai).');
  }
  return Object.freeze(slugs);
}

function readFallbackModels(raw, provider, modelId) {
  // Solo Vercel AI Gateway hace respaldo entre modelos. Vacío = sin respaldo.
  if (provider !== 'vercel') return Object.freeze([]);
  if (raw === undefined) return DEFAULT_FALLBACK_MODELS.filter(m => m !== modelId);
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length > 3 || !list.every(m => GATEWAY_MODEL.test(m))) {
    throw new Error('TURNO_AI_FALLBACK_MODELS inválido; hasta 3 modelos proveedor/modelo separados por coma.');
  }
  return Object.freeze(list.filter(m => m !== modelId));
}

function readAuthMode(provider, env) {
  const keyEnv = presentKeyEnv(provider, env);
  if (keyEnv) return { authMode: 'api-key', keyEnv };
  if (provider === 'vercel') {
    const onVercel = env.VERCEL === '1' || ['production', 'preview', 'development'].includes(env.VERCEL_ENV);
    if (onVercel || env.VERCEL_OIDC_TOKEN) return { authMode: 'oidc', keyEnv: null };
  }
  if (PROVIDERS[provider].awsChain && hasAwsChain(env)) return { authMode: 'aws-credentials', keyEnv: null };
  return { authMode: 'missing', keyEnv: null };
}

export function readGatewaySettings(env = process.env) {
  const provider = (env.TURNO_AI_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
  if (!PROVIDER_NAMES.includes(provider)) {
    throw new Error('TURNO_AI_PROVIDER inválido; usa: ' + PROVIDER_NAMES.join(', ') + '.');
  }
  const modelId = (env.TURNO_AI_MODEL_ID || PROVIDERS[provider].defaultModel).trim();
  const decisionModelId = (env.TURNO_DECISION_MODEL_ID || DEFAULT_DECISION_MODEL_ID).trim();
  const decisionMode = (env.TURNO_DECISION_MODE || 'GATEWAY').trim().toUpperCase();
  const modelPattern = provider === 'vercel' ? GATEWAY_MODEL : GENERIC_MODEL;
  if (!modelPattern.test(modelId) || !GATEWAY_MODEL.test(decisionModelId)) throw new Error('Modelo de AI Gateway inválido.');
  if (!MODES.has(decisionMode)) throw new Error('Modo de decisión inválido.');
  const providerOnly = readProviderOnly(env.TURNO_GATEWAY_ONLY);
  const fallbackModels = readFallbackModels(env.TURNO_AI_FALLBACK_MODELS, provider, modelId);
  const reasoningEffort = (env.TURNO_AI_REASONING_EFFORT || 'low').trim().toLowerCase();
  if (!EFFORTS.has(reasoningEffort)) throw new Error('TURNO_AI_REASONING_EFFORT inválido.');
  const region = provider === 'bedrock' ? (env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1').trim() : null;
  if (region !== null && !REGION.test(region)) throw new Error('AWS_REGION inválida.');
  const rawThreshold = (env.TURNO_DECISION_MIN_CONFIDENCE ?? '').trim();
  const decisionMinConfidence = rawThreshold === '' ? DEFAULT_DECISION_MIN_CONFIDENCE : Number(rawThreshold);
  if (!Number.isFinite(decisionMinConfidence) || decisionMinConfidence < 0 || decisionMinConfidence > 1) {
    throw new Error('TURNO_DECISION_MIN_CONFIDENCE debe estar entre 0 y 1.');
  }
  const enabled = env.TURNO_AI_ENABLED === '1';
  if (env.TURNO_SYNTHETIC_ONLY === '0') throw new Error('El piloto no autoriza datos reales.');
  const syntheticOnly = true;
  const { authMode, keyEnv } = readAuthMode(provider, env);
  if (enabled && authMode === 'missing') {
    throw new Error(provider === 'vercel'
      ? 'Sin autenticación de AI Gateway en el servidor: configura AI_GATEWAY_API_KEY o despliega con OIDC en Vercel.'
      : 'Sin autenticación para ' + provider + ' en el servidor: configura ' + PROVIDERS[provider].keyEnv.join(' o ') +
        (PROVIDERS[provider].awsChain ? ' o credenciales AWS' : '') + '.');
  }
  return Object.freeze({ provider, modelId, decisionModelId, decisionMode, decisionMinConfidence, enabled, syntheticOnly,
    providerOnly, fallbackModels, reasoningEffort, region, authMode, keyEnv });
}

/**
 * Opciones por llamada para Vercel AI Gateway (sin secretos).
 * - gateway.only: enruta solo a los proveedores permitidos (BYOK de OpenAI).
 * - gateway.models: modelos de respaldo en orden si el principal falla.
 * - gateway.tags: permite filtrar el gasto del piloto en el panel de Vercel.
 * - openai.reasoningEffort: acota tokens de razonamiento en modelos GPT-5+/o*.
 */
export function gatewayProviderOptions(settings) {
  const gateway = { tags: ['turno', 'synthetic-pilot'] };
  if (settings.providerOnly) gateway.only = [...settings.providerOnly];
  if (settings.fallbackModels?.length) gateway.models = [...settings.fallbackModels];
  const options = { gateway };
  if (isOpenAIReasoningModel('vercel', settings.modelId)) {
    options.openai = { reasoningEffort: settings.reasoningEffort };
  }
  return options;
}

export function assertSyntheticEvent(event, settings) {
  if (!settings.enabled) throw new Error('Agente ambiental desactivado.');
  if (!event || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id || '')) throw new Error('ID de evento inválido.');
  if (event.synthetic !== true) throw new Error('Solo datos sintéticos autorizados para el piloto.');
}
