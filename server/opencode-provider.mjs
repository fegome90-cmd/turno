import { readOpenCodeSettings } from './opencode-config.mjs';

/**
 * Punto de integración del adaptador comunitario:
 * https://github.com/aprasadh/model-opencode
 *
 * Solo ejecución en servidor. El paquete lee OPENCODE_API_KEY de process.env.
 * No conecta a OpenCode hasta que un consumidor invoque el modelo.
 *
 * OpenCode Go exige sessionId estable dentro de un contexto y aislado entre
 * contextos. El backend, no el frontend ni una variable global, lo proporciona.
 */
export async function createOpenCodeModel({ sessionId } = {}) {
  const config = readOpenCodeSettings();
  if (config.mode === 'go' && (typeof sessionId !== 'string' || !sessionId.trim())) {
    throw new Error('OpenCode Go requiere sessionId aislado por contexto de turno.');
  }

  const { opencodeGo, opencodeZen } = await import('@guru.prasath/model-opencode');
  return config.mode === 'go'
    ? opencodeGo({ modelId: config.modelId, sessionId: sessionId.trim() })
    : opencodeZen({ modelId: config.modelId });
}
