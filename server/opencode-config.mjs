/**
 * Configuración privada del adaptador OpenCode.
 * SOLO backend: nunca importar este módulo desde el frontend de Turno.
 * No devuelve ni imprime la API key; el paquete la lee de process.env.
 */
const MODES = new Set(['zen', 'go']);

export function readOpenCodeSettings(env = process.env) {
  const apiKey = env.OPENCODE_API_KEY;
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey !== apiKey.trim()) {
    throw new Error('OPENCODE_API_KEY ausente o con espacios externos. Configúrala solo en el servidor.');
  }

  const mode = (env.OPENCODE_MODE || 'zen').trim().toLowerCase();
  if (!MODES.has(mode)) {
    throw new Error('OPENCODE_MODE debe ser zen o go.');
  }

  const modelId = (env.OPENCODE_MODEL_ID || '').trim();
  if (!modelId) {
    throw new Error('Configura OPENCODE_MODEL_ID en el servidor.');
  }

  if (mode === 'go') {
    const sessionId = (env.OPENCODE_SESSION_ID || '').trim();
    if (!sessionId) {
      throw new Error('OpenCode Go requiere OPENCODE_SESSION_ID en el servidor.');
    }
    return Object.freeze({ mode, modelId, sessionId });
  }

  return Object.freeze({ mode, modelId });
}
