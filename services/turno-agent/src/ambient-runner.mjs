import {inspectAmbientEvent} from './ambient-policy.mjs';
import {createSuggestionGate} from './suggestion-gate.mjs';
import {classifySemantic} from './semantic-decision.mjs';

const texts=Object.freeze({
  PROPOSE_TASK:'La nota podría contener una tarea pendiente. Revísala antes de agregarla.',
  PROPOSE_REMINDER:'La nota podría solicitar un recordatorio. Revísalo antes de programarlo.',
  NEEDS_REVIEW:'La nota es ambigua. Revisa si requiere una acción.',
});

/** Read-only Turno event consumer. A caller authenticated by a future backend
 * must supply a synthetic, authorized snapshot. No persistence or UI transport.
 * No tools for task mutations exist in this module.
 */
export function createAmbientRunner({gate=createSuggestionGate(),generative,decisions,mode='GATEWAY',record}={}) {
  if(!gate||typeof gate.filter!=='function')throw new Error('Falta el filtro de sugerencias.');
  return Object.freeze({async analyze(event){
    const deterministic=inspectAmbientEvent(event);
    let candidates=deterministic;
    if(event.kind==='note_saved'){
      const note=event.note;
      if(!note||typeof note.text!=='string'||note.text.length>500||!note.text.trim()){
        throw new Error('La nota sintética debe tener texto acotado.');
      }
      const decision=await classifySemantic({
        event:{id:event.id,source:'synthetic',text:note.text},
        mode,generative,decisions,record,
      });
      if(decision.status==='candidate'&&texts[decision.label]) {
        candidates=[Object.freeze({
          id:`semantic:${decision.label}:${event.id}`,
          code:decision.label,
          taskIds:[],
          message:texts[decision.label],
          requiresReview:true,
        })];
      }
    }
    return Object.freeze(gate.filter(event.id,candidates));
  }});
}
