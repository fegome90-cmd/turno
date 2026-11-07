import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTemporalDraft,applyTemporalDraft} from '../src/draft-state.mjs';
test('raw temporal draft retains edits before validation and across re-render',()=>{const raw=createTemporalDraft({date:'2026-11-07',time:'',estimate:'',performed:'',duration:''});raw.date='08/11/2026';raw.time='09:30';const fresh=structuredClone(raw);assert.equal(fresh.date,'08/11/2026');assert.equal(fresh.time,'09:30');const t=applyTemporalDraft({title:'Task'},fresh);assert.equal(t.date,'2026-11-08');assert.equal(t.time,'09:30');});
test('invalid temporal text survives validation failure',()=>{const raw=createTemporalDraft({date:null,time:'',estimate:'',performed:'',duration:''});raw.date='31/02/2026';assert.throws(()=>applyTemporalDraft({date:null},raw));assert.equal(raw.date,'31/02/2026');});
test('applying temporal fields does not mutate source entity',()=>{const t={date:'2026-11-07',time:''};const raw=createTemporalDraft(t);raw.time='11:30';applyTemporalDraft(t,raw);assert.equal(t.time,'');});
