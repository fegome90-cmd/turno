import {readGatewayConfig} from './config.mjs';
import {INTENT_LABELS} from './gateway-agent.mjs';
const labels=new Set(INTENT_LABELS);
const criteria=Object.freeze({
  NO_ACTION:'La nota no contiene un compromiso operativo pendiente ni una solicitud de aviso.',
  PROPOSE_TASK:'La nota expresa una tarea operativa pendiente para revisión.',
  PROPOSE_REMINDER:'La nota solicita explícitamente recibir un aviso futuro.',
  NEEDS_REVIEW:'La intención es ambigua y requiere interpretación humana.',
});

async function defaultModules(){
  const {gateway,experimental_decide:decide}=await import('ai');
  return {gateway,decide};
}

/** Closed-choice Decision API, secondary classifier; no Strands agent or tools here. */
export async function createDecisionClassifier({env=process.env,loadModules=defaultModules}={}){
  const {decisionModelId}=readGatewayConfig(env);
  const {gateway,decide}=await loadModules();
  return async function classify(note){
    if(note?.source!=='synthetic'||typeof note.text!=='string'||!note.text.trim()||note.text.length>500){
      throw new Error('Solo notas sintéticas acotadas.');
    }
    const result=await decide({
      model:gateway.decisionModel(decisionModelId),
      state:note.text,
      questions:{intent:{type:'choice',instructions:'Clasifica esta nota operativa sintética.',criteria}},
    });
    const answer=result?.answers?.intent;
    if(!labels.has(answer?.choice)||!Number.isFinite(answer?.confidence)||answer.confidence<0||answer.confidence>1){
      throw new Error('Decision API: choice o confidence inválida.');
    }
    return {label:answer.choice,confidence:answer.confidence};
  };
}
