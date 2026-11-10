import { readOpenCodeSettings } from './opencode-config.mjs';

try {
  const { mode, modelId } = readOpenCodeSettings();
  console.log(`OpenCode: configuración válida (${mode} / ${modelId}). Credencial presente y oculta. Sin llamadas a red.`);
} catch (error) {
  console.error(`Configuración incompleta: ${error.message}`);
  process.exitCode = 1;
}
