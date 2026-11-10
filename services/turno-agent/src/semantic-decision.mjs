import {INTENT_LABELS} from './gateway-agent.mjs';

const labels=new Set(INTENT_LABELS);
const abstention=(source)=>({status:'abstain',source,label:'NEEDS_REVIEW'});
const normalized=(value,source,minConfidence,needsConfidence)=>{
  if(!labels.has(value?.label))return abstention(source);
  if(needsConfidence && (!Number.isFinite(value.confidence)||value.confidence<minConfidence||value.confidence>1))return abstention(source);
  return {status:value.label==='NO_ACTION'?'no_action':'candidate',source,label:value.label};
};

/** Amazon-style GATEWAY / DUAL / DECISIONS rollout. Never writes tasks. */
export async function classifySemantic({
  event,mode='GATEWAY',generative,decisions,record=()=>{},minConfidence=0.9,
}={}){
  if(event?.source!=='synthetic'||typeof event.id!=='string'||!event.id.trim()||typeof event.text!=='string'||!event.text.trim()||event.text.length>500){
    throw new Error('Solo se acepta un evento sintético identificado y acotado.');
  }
  if(!['GATEWAY','DUAL','DECISIONS'].includes(mode))throw new Error('Modo inválido.');
  if(!Number.isFinite(minConfidence)||minConfidence<0||minConfidence>1)throw new Error('Confianza inválida.');
  if(mode!=='DECISIONS' && typeof generative!=='function')throw new Error('Falta generative (Strands).');
  if(mode!=='GATEWAY' && typeof decisions!=='function')throw new Error('Falta decisions (API).');

  const primary=async()=>{
    try{return normalized(await generative(event),'GATEWAY',minConfidence,false);}
    catch{return abstention('GATEWAY');}
  };
  const secondary=async()=>{
    try{return normalized(await decisions(event),'DECISIONS',minConfidence,true);}
    catch{return abstention('DECISIONS');}
  };

  if(mode==='GATEWAY')return primary();
  if(mode==='DECISIONS')return secondary();
  const [active,shadow]=await Promise.all([primary(),secondary()]);
  try{
    await record(Object.freeze({
      eventId:event.id,activeLabel:active.label,shadowLabel:shadow.label,
      agree:active.label===shadow.label&&active.status===shadow.status,
    }));
  }catch{/* telemetry is not a product dependency */}
  return active;
}
