// Local OFFLINE synthetic smoke test: no model, credentials, or network.
import {inspectAmbientEvent} from './ambient-policy.mjs';
import {createSuggestionGate} from './suggestion-gate.mjs';

const tasks=[
 {id:'A',bedId:null,bedLabel:'Cama 4',title:'Revisar tarea pendiente A',time:'15:00',date:null,completed:false},
 {id:'B',bedId:null,bedLabel:'Cama 4',title:'Revisar tarea pendiente B',time:'15:00',date:null,completed:false},
 {id:'C',bedId:null,title:'Completar informe',constraint:'before-close',time:'',date:null,completed:false},
];
const fixture={id:'evt1',source:'synthetic',kind:'task_saved',beds:[{id:'bed-1',label:'Cama 1'},{id:'bed-2',label:'Cama 2'}],tasks};
const gate=createSuggestionGate();
const first=gate.filter(fixture.id,inspectAmbientEvent(fixture));
const closing=gate.filter('evt2',inspectAmbientEvent({...fixture,id:'evt2',kind:'shift_close_attempt'}));
console.log(JSON.stringify({mode:'offline-synthetic',capture:first,closing,hasWrites:false},null,2));
