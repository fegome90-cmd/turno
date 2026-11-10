/**
 * Turno: configuración del proveedor remoto. Nunca devuelve secretos.
 * En Vercel el AI SDK usa OIDC si AI_GATEWAY_API_KEY no está configurada.
 */
const MODELS = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
const MODES = new Set(['GATEWAY', 'DUAL', 'DECISION']);
export function readGatewaySettings(env = process.env) {
  const modelId = (env.TURNO_AI_MODEL_ID || 'anthropic/claude-haiku-4.5').trim();
  const decisionModelId = (env.TURNO_DECISION_MODEL_ID || 'microsoft/microsoft-decision-1').trim();
  const decisionMode = (env.TURNO_DECISION_MODE || 'GATEWAY').trim().toUpperCase();
  if (!MODELS.test(modelId) || !MODELS.test(decisionModelId)) throw new Error('Modelo de AI Gateway inválido.');
  if (!MODES.has(decisionMode)) throw new Error('Modo de decisión inválido.');
  const enabled = env.TURNO_AI_ENABLED === '1';
  const syntheticOnly = env.TURNO_SYNTHETIC_ONLY !== '0'; // Safe default
  const hasKey = typeof env.AI_GATEWAY_API_KEY === 'string' && env.AI_GATEWAY_API_KEY.trim().length > 0;
  const onVercel = env.VERCEL === '1' || ['production', 'preview', 'development'].includes(env.VERCEL_ENV);
  if (enabled && !hasKey && !onVercel && !env.VERCEL_OIDC_TOKEN) {
    throw new Error('Sin autenticación de AI Gateway en el servidor: configura AI_GATEWAY_API_KEY o despliega con OIDC en Vercel.');
  }
  return Object.freeze({ modelId, decisionModelId, decisionMode, enabled, syntheticOnly,
    authMode: hasKey ? 'api-key' : onVercel || !!env.VERCEL_OIDC_TOKEN ? 'oidc' : 'missing' });
}
export function assertSyntheticEvent(event, settings) {
  if (!settings.enabled) throw new Error('Agente ambiental desactivado.');
  if (!event || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id || '')) throw new Error('ID de evento inválido.');
  if (settings.syntheticOnly && event.synthetic !== true) throw new Error('Solo datos sintéticos autorizados para el piloto.');
}
