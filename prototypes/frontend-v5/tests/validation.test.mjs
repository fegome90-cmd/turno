import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEditor} from '../src/validation.mjs';
const draft={title:'Tarea',body:''};
const temporal={date:'07/11/2026',time:'',estimate:'',performed:'',duration:''};
test('validation distinguishes fields in the same semantic family',()=>{
 const errors=validateEditor(draft,{...temporal,time:'25:00',performed:'30:00',estimate:'-1',duration:'1441'});
 assert.deepEqual(Object.keys(errors),['time','estimate','performed','duration']);
 for(const [id,label] of [['time','Hora prevista'],['estimate','Estimación'],['performed','Hora realizada'],['duration','Duración registrada']])assert.ok(errors[id].startsWith(label));
});
test('civil date validation, date dependency, valid boundaries and note isolation',()=>{
 assert.ok(validateEditor(draft,{...temporal,date:'31/02/2026'}).date);
 assert.ok(validateEditor(draft,{...temporal,date:'',time:'14:30'}).date);
 assert.deepEqual(validateEditor(draft,{...temporal,date:'29/02/2024',time:'23:59',performed:'00:00',estimate:'0',duration:'1440'}),{});
 assert.deepEqual(validateEditor(draft,null,true),{});
 assert.ok(validateEditor({...draft,title:'   '},null,true).title);
});
