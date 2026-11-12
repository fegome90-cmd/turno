// Dominio real: se prueban las operaciones del puerto de Turno sin reemplazar modelos.
import {describe, expect, it} from 'vitest';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import {collectAmbientSuggestions, newReviewDraft, reviewInput} from '../../src/ambient/review';

describe('captura y sugerencias verificables', () => {
  it('no inventa fecha para una hora y exige revisión del turno y la lista', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    const draft = {...newReviewDraft('a', 'Revisar tarea A'), bedId:'bed-1', time:'15:00'};
    expect(reviewInput(draft,snapshot).error).toMatch(/Confirma una fecha/);
    expect(reviewInput({...draft,date:'2026-11-07'},snapshot).value).toMatchObject({
      shiftId:'demo-shift-1',bedId:'bed-1',date:'2026-11-07',time:'15:00',
    });
    expect(reviewInput({...draft,bedId:'bed-not-found',date:'2026-11-07'},snapshot).error).toMatch(/lista válida/);
    expect(reviewInput({...draft,date:'2026-02-30'},snapshot).error).toMatch(/Fecha inválida/);
  });
  it('antes del cierre conserva la condición sin inventar hora', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    const input = reviewInput({...newReviewDraft('c','Completar informe'), beforeClose:true},snapshot);
    expect(input.value).toMatchObject({date:null,time:'',beforeClose:true});
    expect(reviewInput({...newReviewDraft('c','Informe'),beforeClose:true,time:'18:00',date:'2026-11-07'},snapshot).error).toMatch(/no debe tener/);
    const task = await adapter.createReviewedTask(input.value!);
    expect(task).toMatchObject({title:'Completar informe',beforeClose:true,date:null,time:''});
    expect(collectAmbientSuggestions(await adapter.load()).map((x)=>x.kind)).toContain('before-close');
  });
  it('el puerto agrega solo una tarea validada de forma atómica', async () => {
    const adapter = createPreviewAdapter();
    const before = (await adapter.load()).tasks.length;
    await expect(adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Fuera de turno',bedId:'otro',date:null,time:'',beforeClose:false})).rejects.toThrow(/lista/);
    await expect(adapter.createReviewedTask({shiftId:'otro',title:'No corresponde',bedId:null,date:null,time:'',beforeClose:false})).rejects.toThrow(/turno activo/);
    expect((await adapter.load()).tasks.length).toBe(before);
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea A',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea B',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    const suggestions=collectAmbientSuggestions(await adapter.load());
    expect(suggestions.filter((s)=>s.kind==='shared-slot')).toHaveLength(1);
    expect(suggestions[0].detail).toContain('no demuestra duplicidad');
    const snapshot=await adapter.load();
    const a=snapshot.tasks.find((task)=>task.title==='Revisar tarea A')!;
    await adapter.saveTask({...a,completed:true});
    expect(collectAmbientSuggestions(await adapter.load()).some((s)=>s.kind==='shared-slot')).toBe(false);
  });
});

describe('R1b identidad de sugerencias', () => {
  it('R1b-T01: el mismo hecho produce el mismo id en 20 evaluaciones y 3 guardados idénticos', async () => {
    const adapter = createPreviewAdapter();
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea A',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea B',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    let snapshot = await adapter.load();
    const first = collectAmbientSuggestions(snapshot);
    expect(first.filter((s) => s.kind === 'shared-slot')).toHaveLength(1);
    const repeated = Array.from({length: 20}, () => collectAmbientSuggestions(snapshot).map((s) => s.id));
    for (const ids of repeated) expect(ids).toEqual(first.map((s) => s.id));
    for (const title of ['Revisar tarea A', 'Revisar tarea B', 'Revisar tarea A']) {
      const task = snapshot.tasks.find((item) => item.title === title)!;
      await adapter.saveTask({...task});
      snapshot = await adapter.load();
      expect(collectAmbientSuggestions(snapshot).map((s) => s.id)).toEqual(first.map((s) => s.id));
    }
    expect(collectAmbientSuggestions(snapshot).filter((s) => s.kind === 'shared-slot')).toHaveLength(1);
  });
  it('R1b-T03: cerrar la jornada activa deja 0 sugerencias', async () => {
    const adapter = createPreviewAdapter();
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea A',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await adapter.createReviewedTask({shiftId:'demo-shift-1',title:'Completar informe',bedId:null,date:null,time:'',beforeClose:true});
    expect(collectAmbientSuggestions(await adapter.load()).length).toBeGreaterThan(0);
    await adapter.closeShift('demo-shift-1');
    expect(collectAmbientSuggestions(await adapter.load())).toHaveLength(0);
  });
});
