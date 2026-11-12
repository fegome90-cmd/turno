import {fileURLToPath} from 'node:url';
import {InvokeModelStage} from '@strands-agents/sdk';
import {ContextInjector} from '@strands-agents/sdk/vended-plugins/context-injector';
import {CedarAuthorization} from '@strands-agents/sdk/vended-interventions/cedar';

const STAGES = new Set(['classification', 'extraction', 'capture']);
const SOURCES = new Set(['synthetic-harness', 'confirmed-note', 'capture-input']);
const POLICY_PATH = fileURLToPath(new URL('./policies/turno-readonly.cedar', import.meta.url));

/** Data minimization only, NOT user authentication. Callers authorize before creating the agent. */
export function prepareModelContext(stage, modelContext) {
  if (!STAGES.has(stage)) throw new Error('invalid_model_context');
  const source = modelContext?.source ?? 'synthetic-harness';
  if (!SOURCES.has(source) || (modelContext !== undefined &&
      (!modelContext || typeof modelContext !== 'object' || Array.isArray(modelContext) ||
       Object.keys(modelContext).some(key => !['source', 'noteVersion'].includes(key))))) {
    throw new Error('invalid_model_context');
  }
  const noteVersion = modelContext?.noteVersion;
  if ((source === 'confirmed-note' && (!Number.isInteger(noteVersion) || noteVersion < 1 || noteVersion > 1_000_000)) ||
      (source !== 'confirmed-note' && noteVersion !== undefined)) throw new Error('invalid_model_context');
  if ((stage === 'capture' && source === 'confirmed-note') || (stage !== 'capture' && source === 'capture-input')) {
    throw new Error('invalid_model_context');
  }
  // Only fixed enums, booleans and an optional bounded integer reach the prompt.
  return Object.freeze({schema:'turno_context_v2', stage, source, synthetic:true, reviewOnly:true,
    ...(source === 'confirmed-note' && {noteVersion})});
}

/** Fresh native extensions per Agent. Never shared across notes, shifts or invocations. */
export function createTurnoExtensions({stage, modelContext, signal}) {
  signal?.throwIfAborted();
  const context = prepareModelContext(stage, modelContext);
  const text = '<turno_context>' + JSON.stringify(context) + '</turno_context>';
  let rendered = 0, checked = 0;
  const injector = new ContextInjector({
    name:'turno:context', trigger:'everyTurn',
    renderContent: () => {rendered++; return text;},
  });
  // Native ContextInjector fails open on a renderer error. This next input transformer
  // fails closed if that happened, or if injection was skipped/reordered/removed.
  const requiredContext = {
    name:'turno:required-context',
    initAgent(agent) {
      agent.addMiddleware(InvokeModelStage.Input, input => {
        signal?.throwIfAborted();
        const user = [...input.messages].reverse().find(message => message.role === 'user');
        const last = user?.toJSON().content.at(-1)?.text;
        if (rendered !== checked + 1 || typeof last !== 'string' || last.trim() !== text) {
          throw new Error('required_context_unavailable');
        }
        checked++;
        return input;
      });
    },
  };
  const cedar = new CedarAuthorization({
    policies:POLICY_PATH,
    principal:{type:'User', id:'turno-synthetic-agent'},
    // These values come from the application closure, never tool input or note text.
    contextEnricher: () => ({synthetic:true, review_only:true, stage,
      context_ready:checked > 0 && !signal?.aborted}),
    onError:'deny',
  });
  return {plugins:[injector, requiredContext], interventions:[cedar]};
}
