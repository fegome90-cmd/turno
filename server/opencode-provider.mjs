import { readOpenCodeSettings } from './opencode-config.mjs';

/**
 * Punto de integración del adaptador comunitario:
 * https://github.com/aprasadh/model-opencode
 *
 * Solo ejecución en servidor. No pasa la clave como argumento ni la expone
 * al frontend: el paquete lee OPENCODE_API_KEY del entorno del servidor.
 * No conecta a OpenCode hasta que un consumidor invoque el modelo.
 */
export async function createOpenCodeModel() {
  const config = readOpenCodeSettings();
  const { opencodeGo, opencodeZen } = await import('@guru.prasath/model-opencode');
  return config.mode === 'go'
    ? opencodeGo({ modelId: config.modelId, sessionId: config.sessionId })
    : opencodeZen({ modelId: config.modelId });
}
