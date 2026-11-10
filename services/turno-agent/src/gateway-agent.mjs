import {readGatewayConfig} from './config.mjs';

export const INTENT_LABELS=Object.freeze(['NO_ACTION','PROPOSE_TASK','PROPOSE_REMINDER','NEEDS_REVIEW']);
const catalog=new Set(INTENT_LABELS);

const SYSTEM_PROMPT=`Eres un clasificador auxiliar de Turno. Solo evalúas notas operativas sintéticas.
Clasifica el texto en una de cuatro etiquetas: NO_ACTION, PROPOSE_TASK,
PROPOSE_REMINDER o NEEDS_REVIEW. No diagnostiques, no sugieras intervenciones
clínicas, no asignes prioridad asistencial, no inventes horarios ni camas.
No ejecutes acciones ni expongas datos externos. Todo resultado requiere revisión humana.`;

async function defaultModules(){
  const [{Agent},{VercelModel},{gateway},{z}]=await Promise.all([
    import('@strands-agents/sdk'),
    import('@strands-agents/sdk/models/vercel'),
    import('ai'),
    import('zod'),
  ]);
  return {Agent,VercelModel,gateway,z};
}

// The real production path is Strands Agents + the first-party VercelModel.
// `loadModules` exists only to test wiring without making external API calls.
export async function createGatewayClassifier({env=process.env,loadModules=defaultModules}={}) {
  const {modelId}=readGatewayConfig(env);
  const {Agent,VercelModel,gateway,z}=await loadModules();
  const agent=new Agent({
    model:new VercelModel({provider:gateway(modelId),maxTokens:200,temperature:0}),
    systemPrompt:SYSTEM_PROMPT,
    structuredOutputSchema:z.object({label:z.enum(INTENT_LABELS)}),
    // No tools: the classifier has no access to app writes or arbitrary tools.
    tools:[],
  });
  return async function classify(note) {
    if (note?.source!=='synthetic' || typeof note.text!=='string' ||
        !note.text.trim() || note.text.length>500) {
      throw new Error('Solo se aceptan notas sintéticas no vacías, de hasta 500 caracteres.');
    }
    const result=await agent.invoke(JSON.stringify({text:note.text}));
    const label=result?.structuredOutput?.label;
    if (!catalog.has(label)) throw new Error('Respuesta del modelo: label inválida.');
    return {label};
  };
}
