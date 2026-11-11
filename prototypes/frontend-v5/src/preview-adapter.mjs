import {parseDate,displayDate,localDate} from './format.mjs';
const clone=x=>structuredClone(x);
const titled=value=>{if(typeof value!=='string'||!value.trim()||value.length>300) throw new Error('Escribe un título de 1 a 300 caracteres.');return value.trim();};
export function createPreviewAdapter({delay=0,preferredName='Demo'}={}) {
  let failure=null, sequence=10;
  const state={profile:{preferredName},activeShiftId:'demo-shift-1',shifts:[{id:'demo-shift-1',label:'Turno de día',date:'2026-11-07',status:'open'}],beds:[{id:'bed-1',shiftId:'demo-shift-1',label:'Cama 1'},{id:'bed-2',shiftId:'demo-shift-1',label:'Cama 2'}],notes:[{id:'note-1',title:'Notas generales',body:'',version:1}],tasks:[
    {id:'task-1',shiftId:'demo-shift-1',bedId:'bed-1',title:'Tarea 1',body:'',reason:'Exámenes',priority:'normal',date:'2026-11-07',time:'',estimate:'',performed:'',duration:'',completed:false,version:1},
    {id:'task-2',shiftId:'demo-shift-1',bedId:'bed-1',title:'Revisar insumos',body:'',reason:'Organización',priority:'normal',date:'2026-11-07',time:'11:30',estimate:'20',performed:'',duration:'',completed:false,version:1},
    {id:'task-3',shiftId:'demo-shift-1',bedId:'bed-1',title:'Preparar educación',body:'',reason:'Preparación',priority:'normal',date:null,time:'',estimate:'',performed:'',duration:'',completed:false,version:1},
    {id:'task-4',shiftId:'demo-shift-1',bedId:'bed-2',title:'Revisar material',body:'',reason:'Organización',priority:'high',date:'2026-11-07',time:'14:00',estimate:'',performed:'',duration:'',completed:false,version:1}
  ]};
  const current=()=>{const s=state.shifts.find(s=>s.id===state.activeShiftId&&s.status==='open');if(!s)throw new Error('Inicia un turno para continuar.');return s;};
  async function wait(){if(delay)await new Promise(r=>setTimeout(r,delay));if(failure){const f=failure;failure=null;const error=new Error(f==='conflict'?'Conflicto simulado. No se aplicó el cambio. Vuelve a intentar la acción.':'Fallo simulado de conexión. No se aplicó el cambio. Vuelve a intentar la acción.');error.code=f==='conflict'?'SIMULATED_CONFLICT':'SIMULATED_FAILURE';throw error;}}
  const validateTask=t=>{
    const title=titled(t.title); if(typeof t.body!=='string'||t.body.length>10000)throw new Error('Notas: máximo 10.000 caracteres.');
    if(t.date)parseDate(displayDate(t.date));
    for(const value of [t.time,t.performed]) if(value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Usa una hora válida de 24 horas: HH:mm.');
    if(t.time&&!t.date)throw new Error('Agrega una fecha antes de indicar una hora.');
    for(const value of [t.estimate,t.duration])if(value!==''&&(!/^\d+$/.test(String(value))||Number(value)>1440))throw new Error('Usa minutos entre 0 y 1440.');
    if(!['normal','high','low'].includes(t.priority))throw new Error('Prioridad no válida.');
    return {...t,title};
  };
  return {
    async load(){await wait();return clone(state);},
    failNext(kind){failure=kind;},
    async saveTask(task){await wait();const i=state.tasks.findIndex(t=>t.id===task.id);if(i<0)throw new Error('Tarea no encontrada.');const old=state.tasks[i];if(state.shifts.find(s=>s.id===old.shiftId)?.status!=='open')throw new Error('Este turno está cerrado y es de solo lectura.');if(old.version!==task.version)throw new Error('La versión cambió. Tu borrador se conserva.');if(task.shiftId!==old.shiftId||task.bedId!==old.bedId)throw new Error('Relación de tarea no válida.');const valid=validateTask(task);state.tasks[i]={...valid,version:old.version+1};return clone(state.tasks[i]);},
    async saveNote(note){await wait();const i=state.notes.findIndex(n=>n.id===note.id);if(i<0)throw new Error('Nota no encontrada.');if(note.version!==state.notes[i].version)throw new Error('La versión cambió.');if(typeof note.body!=='string'||note.body.length>10000)throw new Error('Notas: máximo 10.000 caracteres.');state.notes[i]={id:note.id,title:titled(note.title),body:note.body,version:note.version+1};return clone(state.notes[i]);},
    async createNote(title){await wait();const note={id:`note-${++sequence}`,title:titled(title),body:'',version:1};state.notes.push(note);return clone(note);},
    async createBed(label){await wait();const s=current();const b={id:`bed-${++sequence}`,label:titled(label),shiftId:s.id};state.beds.push(b);return clone(b);},
    async renameBed(id, label) {
      await wait();
      const bed = state.beds.find(item => item.id === id);
      if (!bed) throw new Error('Cama no encontrada.');
      if (state.shifts.find(item => item.id === bed.shiftId)?.status !== 'open') {
        throw new Error('Este turno está cerrado y es de solo lectura.');
      }
      // A label is presentation. Stable IDs keep every task in its original group,
      // even when two groups deliberately share the same name.
      bed.label = titled(label);
      return clone(bed);
    },
    async createTask(title,bedId=null){await wait();const s=current();if(bedId&&!state.beds.some(b=>b.id===bedId&&b.shiftId===s.id))throw new Error('La cama no pertenece al turno.');const t={id:`task-${++sequence}`,shiftId:s.id,bedId,title:titled(title),body:'',reason:'',priority:'normal',date:null,time:'',estimate:'',performed:'',duration:'',completed:false,version:1};state.tasks.push(t);return clone(t);},
    async closeShift(id){await wait();const s=state.shifts.find(s=>s.id===id);if(!s)throw new Error('Turno no encontrado.');if(s.status==='closed')return clone(s);if(id!==state.activeShiftId)throw new Error('Turno no activo.');s.status='closed';state.activeShiftId=null;return clone(s);},
    async openShift(label){await wait();if(state.activeShiftId)throw new Error('Ya hay un turno abierto.');const s={id:`shift-${++sequence}`,label:titled(label),date:localDate(),status:'open'};state.shifts.push(s);state.activeShiftId=s.id;return clone(s);}
  };
}
