import test from 'node:test';
import assert from 'node:assert/strict';
import {createAmbientRunner} from '../src/ambient-runner.mjs';

const task={id:'A',bedId:null,bedLabel:'Cama 4',time:'15:00',date:null,completed:false};
const fixture={id:'evt-1',source:'synthetic',kind:'task_saved',tasks:[task],beds:[]};

test('rules-only event never asks a model and returns read-only proposals',async()=>{
 const runner=createAmbientRunner();
 const before=JSON.stringify(fixture);
 const hints=await runner.analyze(fixture);
 assert.deepEqual(hints.map(x=>x.code),['LINK_BED','CONFIRM_DATE']);
 assert.equal(JSON.stringify(fixture),before);
 assert.equal(hints.every(x=>x.requiresReview===true),true);
 assert.equal('write' in runner,false);
});

test('note event uses Strands classification only to suggest human review',async()=>{
 let calls=0;
 const runner=createAmbientRunner({generative:async()=>{calls++;return {label:'PROPOSE_TASK'};}});
 const event={id:'note-1',source:'synthetic',kind:'note_saved',tasks:[],beds:[],note:{text:'Revisar informe'}};
 const first=await runner.analyze(event);
 assert.equal(calls,1);
 assert.equal(first.length,1);
 assert.equal(first[0].code,'PROPOSE_TASK');
 assert.equal(first[0].requiresReview,true);
 assert.equal((await runner.analyze(event)).length,0);
});

test('DUAL disagreements never override the Strands primary decision',async()=>{
 const traces=[];
 const runner=createAmbientRunner({mode:'DUAL',generative:async()=>({label:'PROPOSE_REMINDER'}),decisions:async()=>({label:'NO_ACTION',confidence:0.99}),record:r=>traces.push(r)});
 const result=await runner.analyze({id:'note-2',source:'synthetic',kind:'note_saved',tasks:[],beds:[],note:{text:'Recuérdame terminar el informe'}});
 assert.equal(result[0].code,'PROPOSE_REMINDER');
 assert.equal(traces.length,1);
 assert.equal(traces[0].agree,false);
 assert.equal(JSON.stringify(traces[0]).includes('Recuérdame'),false);
});

test('errors or model abstention yield no suggestion',async()=>{
 const runner=createAmbientRunner({generative:async()=>{throw new Error('offline');}});
 assert.deepEqual(await runner.analyze({id:'note-3',source:'synthetic',kind:'note_saved',tasks:[],beds:[],note:{text:'Revisar informe'}}),[]);
});

test('rejects invalid/real events before accessing model',async()=>{
 let calls=0;
 const runner=createAmbientRunner({generative:async()=>{calls++;return {label:'PROPOSE_TASK'};}});
 await assert.rejects(runner.analyze({...fixture,source:'real'}),/sintéticos/);
 await assert.rejects(runner.analyze({id:'note-4',source:'synthetic',kind:'note_saved',tasks:[],beds:[],note:{text:'x'.repeat(501)}}),/acotado/);
 assert.equal(calls,0);
});
