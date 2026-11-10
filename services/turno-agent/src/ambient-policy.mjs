// Read-only, deterministic operational checks. Never use the model for exact comparisons.
const EVENT_KINDS=new Set(['task_saved','note_saved','shift_close_attempt']);
const message={
  VERIFY_SHARED_TIME:'Dos tareas de la misma cama comparten horario. Revisa si deben coordinarse.',
  LINK_BED:'Hay tareas con cama sin vincular. Selecciona una cama existente o crea una explícitamente.',
  CONFIRM_DATE:'Hay tareas con hora, pero sin fecha. Confirma la fecha antes de programar.',
  BEFORE_CLOSE_PENDING:'Quedan compromisos marcados para antes del cierre. Revisa los pendientes.',
};
const normalized=v=>typeof v==='string'?v.trim().toLocaleLowerCase('es-CL'):'';
const sortedIds=tasks=>[...new Set(tasks.map(t=>t.id))].sort();
function make(code,tasks){
 const taskIds=sortedIds(tasks);
 return Object.freeze({id:`rule:${code}:${taskIds.join(',')}`,code,taskIds,message:message[code],requiresReview:true});
}
export function inspectAmbientEvent(event){
 if(event?.source!=='synthetic'||!EVENT_KINDS.has(event?.kind))throw new Error('Solo se aceptan eventos sintéticos autorizados.');
 if(!Array.isArray(event.tasks)||event.tasks.length>100||!Array.isArray(event.beds)||event.beds.length>100) {
   throw new Error('El evento requiere arrays acotados de tasks y beds.');
 }
 if(event.tasks.some(t=>!t||typeof t.id!=='string'||!t.id.trim()))throw new Error('tasks contiene IDs inválidos.');
 const pending=event.tasks.filter(t=>!t.completed);
 if(event.kind==='note_saved')return [];
 const results=[];
 if(event.kind==='task_saved'){
   const overlaps=[];
   for(let i=0;i<pending.length;i++){
     for(let j=i+1;j<pending.length;j++){
       const a=pending[i],b=pending[j];
       const aBed=a.bedId||normalized(a.bedLabel),bBed=b.bedId||normalized(b.bedLabel);
       if(a.id!==b.id && aBed && aBed===bBed && a.date===b.date && a.time && a.time===b.time) {
         overlaps.push(a,b);
       }
     }
   }
   if(overlaps.length) results.push(make('VERIFY_SHARED_TIME',overlaps));
   const beds=new Set(event.beds.map(b=>b.id));
   const unlinked=pending.filter(t=>(t.bedId && !beds.has(t.bedId))||(!t.bedId && normalized(t.bedLabel)));
   if(unlinked.length)results.push(make('LINK_BED',unlinked));
   const withoutDate=pending.filter(t=>t.time&&!t.date);
   if(withoutDate.length)results.push(make('CONFIRM_DATE',withoutDate));
 }
 if(event.kind==='shift_close_attempt'){
   const close=pending.filter(t=>t.constraint==='before-close');
   if(close.length)results.push(make('BEFORE_CLOSE_PENDING',close));
 }
 return results;
}
