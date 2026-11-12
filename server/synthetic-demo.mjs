import { inspectDrafts } from './ambient-engine.mjs';
// Sin red, API key, modelos ni pacientes. Solo verifica los ejemplos del brief.
const snapshot = {
  shiftId:'demo-shift',
  beds:[{id:'bed-1',label:'Cama 1'}, {id:'bed-2',label:'Cama 2'}],
  drafts:[
    {id:'a',title:'Revisar tarea pendiente A',bedLabel:'Cama 4',bedId:null,time:'15:00',date:null,completed:false},
    {id:'b',title:'Revisar tarea pendiente B',bedLabel:'Cama 4',bedId:null,time:'15:00',date:null,completed:false},
    {id:'c',title:'Completar informe',bedLabel:null,bedId:null,time:'',date:null,beforeClose:true,completed:false}
  ]
};
const proposals = inspectDrafts(snapshot);
process.stdout.write(JSON.stringify({ mode:'synthetic/no-inference', suggestions:proposals },null,2)+'\n');
