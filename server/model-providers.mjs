/**
 * Registro de proveedores de modelos de Strands Agents (TypeScript), según
 * https://strandsagents.com/docs/user-guide/sdk/model-providers/
 *
 * Solo metadatos públicos: nombres de variables de entorno, URL base y modelo
 * por defecto. Los valores de las claves nunca se guardan aquí ni se devuelven.
 */
export const PROVIDERS = Object.freeze({
  // Vercel AI Gateway (VercelModel + @ai-sdk/gateway). OIDC en Vercel o API key.
  vercel: { kind: 'vercel', keyEnv: ['AI_GATEWAY_API_KEY'], host: 'ai-gateway.vercel.sh',
    defaultModel: 'nvidia/nemotron-3.5-lightning-free' },
  // Primera parte en el SDK.
  openai: { kind: 'openai', keyEnv: ['OPENAI_API_KEY'], host: 'api.openai.com',
    defaultModel: 'gpt-5-mini' },
  anthropic: { kind: 'anthropic', keyEnv: ['ANTHROPIC_API_KEY'], host: 'api.anthropic.com',
    defaultModel: 'claude-haiku-4-5' },
  google: { kind: 'google', keyEnv: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], host: 'generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash' },
  // Credenciales AWS por la cadena estándar, o clave de API de Bedrock.
  bedrock: { kind: 'bedrock', keyEnv: ['AWS_BEARER_TOKEN_BEDROCK'], awsChain: true,
    host: 'bedrock-runtime.<region>.amazonaws.com',
    defaultModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' },
  // Integraciones compatibles con OpenAI (OpenAIModel api: 'chat' + baseURL).
  openrouter: { kind: 'openai-compatible', keyEnv: ['OPENROUTER_API_KEY'], host: 'openrouter.ai',
    baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-5-mini' },
  fireworks: { kind: 'openai-compatible', keyEnv: ['FIREWORKS_API_KEY'], host: 'api.fireworks.ai',
    baseURL: 'https://api.fireworks.ai/inference/v1', defaultModel: 'accounts/fireworks/models/deepseek-v3p1-terminus' },
  nebius: { kind: 'openai-compatible', keyEnv: ['NEBIUS_API_KEY'], host: 'api.tokenfactory.nebius.com',
    baseURL: 'https://api.tokenfactory.nebius.com/v1/', defaultModel: 'deepseek-ai/DeepSeek-R1-0528' },
  ovhcloud: { kind: 'openai-compatible', keyEnv: ['OVHCLOUD_API_KEY'], host: 'oai.endpoints.kepler.ai.cloud.ovh.net',
    baseURL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', defaultModel: 'Meta-Llama-3_3-70B-Instruct' },
  crusoe: { kind: 'openai-compatible', keyEnv: ['CRUSOE_API_KEY'], host: 'api.inference.crusoecloud.com',
    baseURL: 'https://api.inference.crusoecloud.com/v1/', defaultModel: 'zai/GLM-5.2' },
  orcarouter: { kind: 'openai-compatible', keyEnv: ['ORCAROUTER_API_KEY'], host: 'api.orcarouter.ai',
    baseURL: 'https://api.orcarouter.ai/v1', defaultModel: 'orcarouter/auto' },
});

export const PROVIDER_NAMES = Object.freeze(Object.keys(PROVIDERS));
const AWS_CHAIN_VARS = ['AWS_ACCESS_KEY_ID', 'AWS_PROFILE', 'AWS_WEB_IDENTITY_TOKEN_FILE',
  'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI', 'AWS_CONTAINER_CREDENTIALS_FULL_URI'];
// GPT-5+, GPT-6 y serie o: aceptan esfuerzo de razonamiento.
const OPENAI_REASONING = /^(openai\/)?(gpt-5|gpt-6|o\d)/i;

export function isOpenAIReasoningModel(provider, modelId) {
  if (provider === 'openai') return OPENAI_REASONING.test(modelId);
  if (provider === 'vercel') return /^openai\//i.test(modelId) && OPENAI_REASONING.test(modelId);
  return false;
}

const present = v => typeof v === 'string' && v.trim().length > 0;

/** Nombre de la variable con clave presente (nunca su valor). */
export function presentKeyEnv(provider, env) {
  return PROVIDERS[provider].keyEnv.find(name => present(env[name])) ?? null;
}

export function hasAwsChain(env) {
  return AWS_CHAIN_VARS.some(name => present(env[name]));
}
