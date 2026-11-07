import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewAdapter} from '../src/preview-adapter.mjs';
import {parseDate,displayDate} from '../src/format.mjs';
test('date-only is dd/mm/yyyy and leap days validated',()=>{
 assert.equal(parseDate('07/11/2026'),'2026-11-07'); assert.equal(displayDate('2026-11-07'),'07/11/2026');
 assert.equal(parseDate('29/02/2024'),'2024-02-29'); assert.throws(()=>parseDate('29/02/2025')); assert.throws(()=>parseDate('31/04/2026')); assert.equal(parseDate(''),null);
});
test('snapshots are detached',async()=>{const a=createPreviewAdapter();const s=await a.load();s.tasks[0].title='mutated'; assert.notEqual((await a.load()).tasks[0].title,'mutated');});
test('save accepts literal title and increments version',async()=>{const a=createPreviewAdapter();const s=await a.load();const t=s.tasks[0];const u=await a.saveTask({...t,title:'<b>Literal</b>'});assert.equal(u.title,'<b>Literal</b>'); assert.equal(u.version,t.version+1);});
test('save rejects blank title without changing state',async()=>{const a=createPreviewAdapter();const s=await a.load();await assert.rejects(a.saveTask({...s.tasks[0],title:'  '}),/título/i);assert.deepEqual(await a.load(),s);});
test('version conflict preserves confirmed state',async()=>{const a=createPreviewAdapter();const t=(await a.load()).tasks[0];await a.saveTask({...t,title:'First'});await assert.rejects(a.saveTask({...t,title:'Second'}),/versión/i);assert.equal((await a.load()).tasks[0].title,'First');});
test('simulated failed save does not commit',async()=>{const a=createPreviewAdapter();const t=(await a.load()).tasks[0];a.failNext('error');await assert.rejects(a.saveTask({...t,title:'Lost'}),/simulado/i);assert.equal((await a.load()).tasks[0].title,t.title);});
test('close preserves pending tasks and notes; opening is empty',async()=>{const a=createPreviewAdapter();const s=await a.load();await a.closeShift(s.activeShiftId);const c=await a.load();assert.equal(c.activeShiftId,null);assert.deepEqual(c.tasks,s.tasks);assert.deepEqual(c.notes,s.notes);assert.equal(c.shifts[0].status,'closed');const n=await a.openShift('Turno de noche');const r=await a.load();assert.equal(r.tasks.filter(t=>t.shiftId===n.id).length,0);assert.equal(r.beds.filter(b=>b.shiftId===n.id).length,0);});
test('quick note has no shift or bed fields',async()=>{const a=createPreviewAdapter();const n=await a.createNote('Nota general');assert.equal('shiftId' in n,false);assert.equal('bedId' in n,false);});
test('cannot create a task without an open shift or cross-link a bed',async()=>{const a=createPreviewAdapter();const s=await a.load();await assert.rejects(a.createTask('Ejemplo','wrong'),/cama/i);await a.closeShift(s.activeShiftId);await assert.rejects(a.createTask('Ejemplo'),/turno/i);});
test('archive is read only',async()=>{const a=createPreviewAdapter();const s=await a.load();await a.closeShift(s.activeShiftId);await assert.rejects(a.saveTask({...s.tasks[0],title:'Changed'}),/cerrado/i);});
test('only one active shift in preview',async()=>{const a=createPreviewAdapter();await assert.rejects(a.openShift('Duplicate'),/abierto/i);});
test('new bed and task are linked to active shift',async()=>{const a=createPreviewAdapter();const b=await a.createBed('Cama 3');const t=await a.createTask('Nueva tarea',b.id);assert.equal(t.bedId,b.id);assert.equal(t.shiftId,b.shiftId);});
test('note save is independent and ignores foreign linkage fields',async()=>{const a=createPreviewAdapter();const n=(await a.load()).notes[0];const saved=await a.saveNote({...n,body:'Texto general',shiftId:'wrong'});assert.equal(saved.body,'Texto general');assert.equal('shiftId' in saved,false);});
test('time requires date and accepts 24-hour format',async()=>{const a=createPreviewAdapter();const t=(await a.load()).tasks[0];await assert.rejects(a.saveTask({...t,date:null,time:'10:30'}),/fecha/);await assert.rejects(a.saveTask({...t,time:'25:00'}),/hora/);const s=await a.saveTask({...t,time:'23:59'});assert.equal(s.time,'23:59');});
test('close repetition preserves the same result',async()=>{const a=createPreviewAdapter();const s=(await a.load()).activeShiftId;const r=await a.closeShift(s);assert.deepEqual(await a.closeShift(s),r);});

test('renameBed changes only the label and preserves IDs, shift and all task relations',async()=>{
 const a=createPreviewAdapter(),before=await a.load();
 const result=await a.renameBed('bed-1','Cama norte');
 const after=await a.load();
 assert.deepEqual(result,{...before.beds[0],label:'Cama norte'});
 assert.deepEqual(after.tasks,before.tasks);
 assert.deepEqual(after.beds[1],before.beds[1]);
 assert.equal(after.beds[0].id,'bed-1');assert.equal(after.beds[0].shiftId,before.beds[0].shiftId);
});
test('duplicate group names do not merge stable identities or task membership',async()=>{
 const a=createPreviewAdapter(),before=await a.load();
 await a.renameBed('bed-1','Cama 2');const after=await a.load();
 assert.deepEqual(after.beds.map(bed=>bed.label),['Cama 2','Cama 2']);
 assert.deepEqual(after.beds.map(bed=>bed.id),['bed-1','bed-2']);
 assert.deepEqual(after.tasks,before.tasks);
});
test('renameBed rejects invalid labels and missing groups without changing the snapshot',async()=>{
 const a=createPreviewAdapter(),before=await a.load();
 for(const label of ['  ','x'.repeat(301)])await assert.rejects(a.renameBed('bed-1',label),/título/i);
 await assert.rejects(a.renameBed('missing','Nueva'),/encontrada/);
 assert.deepEqual(await a.load(),before);
});
test('renameBed failure leaves label and relationships unchanged; retry can succeed',async()=>{
 const a=createPreviewAdapter(),before=await a.load();a.failNext('error');
 await assert.rejects(a.renameBed('bed-1','Recuperado'),/simulado/);
 assert.deepEqual(await a.load(),before);
 await a.renameBed('bed-1','Recuperado');assert.equal((await a.load()).beds[0].label,'Recuperado');
});
test('archived group cannot be renamed even after opening a new active shift',async()=>{
 const a=createPreviewAdapter();await a.closeShift('demo-shift-1');await a.openShift('Nuevo turno');
 const before=await a.load();await assert.rejects(a.renameBed('bed-1','No cambiar'),/solo lectura/);
 assert.deepEqual(await a.load(),before);
});
