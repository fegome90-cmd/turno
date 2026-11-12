// Integración del frontend React v6, puerto existente y revisión humana; no se simula un LLM.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import {collectAmbientSuggestions} from '../../src/ambient/review';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(()=>{cleanup(); sessions.splice(0).forEach((session)=>session.dispose());});

async function open() {
  Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:1440});
  const session=createSession({port:createPreviewAdapter({delay:0}),random:()=>0}); sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Abrir captura de tareas'}));
  const dialog=await screen.findByRole('dialog',{name:'Captura y sugerencias'});
  return {session,user,dialog};
}

it('no crea tareas al ingresar texto; cada guardado requiere aprobación y fecha válida',async()=>{
  const {session,user,dialog}=await open();
  const before=session.store.getState().snapshot!.tasks.length;
  await user.type(within(dialog).getByRole('textbox',{name:'Tareas para revisar'}),'Revisar tarea pendiente A');
  await user.click(within(dialog).getByRole('button',{name:'Pasar a revisión'}));
  expect(session.store.getState().snapshot!.tasks).toHaveLength(before);
  const card=within(dialog).getByRole('group',{name:/Tarea 1 · Pendiente de aprobación/});
  await user.selectOptions(within(card).getByRole('combobox',{name:'Lista'}),'bed-1');
  fireEvent.change(within(card).getByLabelText('Hora'),{target:{value:'15:00'}});
  await user.click(within(card).getByRole('button',{name:'Aprobar y guardar'}));
  expect(within(card).getByRole('alert')).toHaveTextContent('Confirma una fecha');
  expect(session.store.getState().snapshot!.tasks).toHaveLength(before);
  fireEvent.change(within(card).getByLabelText('Fecha'),{target:{value:'2026-11-07'}});
  await user.click(within(card).getByRole('button',{name:'Aprobar y guardar'}));
  await waitFor(()=>expect(session.store.getState().snapshot!.tasks).toHaveLength(before+1));
  expect(session.store.getState().snapshot!.tasks.at(-1)).toMatchObject({
    title:'Revisar tarea pendiente A',date:'2026-11-07',time:'15:00',bedId:'bed-1',
  });
});

it('una tarea antes del cierre es revisable y genera una sugerencia verificable',async()=>{
  const {session,user,dialog}=await open();
  await user.click(within(dialog).getByRole('button',{name:/Nueva tarjeta/}));
  const card=within(dialog).getByRole('group',{name:/Tarea 1 · Pendiente de aprobación/});
  await user.type(within(card).getByRole('textbox',{name:'Título'}),'Completar informe');
  await user.click(within(card).getByRole('checkbox',{name:/Antes del cierre/}));
  await user.click(within(card).getByRole('button',{name:'Aprobar y guardar'}));
  await waitFor(()=>expect(session.store.getState().snapshot!.tasks.some((t)=>t.title==='Completar informe')).toBe(true));
  expect(session.store.getState().snapshot!.tasks.at(-1)).toMatchObject({beforeClose:true,date:null,time:''});
  await user.click(within(dialog).getByRole('tab',{name:/Sugerencias/}));
  expect(within(dialog).getByText('Pendientes antes del cierre')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button',{name:'Descartar'}));
  expect(within(dialog).queryByText('Pendientes antes del cierre')).not.toBeInTheDocument();
});

it('el diálogo protege los borradores no guardados',async()=>{
  const {user,dialog}=await open();
  await user.type(within(dialog).getByRole('textbox',{name:'Tareas para revisar'}),'Tarea sin guardar');
  await user.click(within(dialog).getByRole('button',{name:'Cerrar captura y sugerencias'}));
  expect(within(dialog).getByText('Hay texto o tareas sin guardar. ¿Quieres descartarlos y cerrar?')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button',{name:'Seguir revisando'}));
  expect(within(dialog).getByRole('textbox',{name:'Tareas para revisar'})).toHaveValue('Tarea sin guardar');
  await user.click(within(dialog).getByRole('button',{name:'Cerrar captura y sugerencias'}));
  await user.click(within(dialog).getByRole('button',{name:'Descartar y cerrar'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Captura y sugerencias'})).not.toBeInTheDocument());
});

it('dos tareas en la misma lista y horario generan una sugerencia sin aviso global',async()=>{
  const {session,user,dialog}=await open();
  const noticesBefore=session.notifications.getState().items.length;
  await act(async()=>{
    await session.port.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea A',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await session.port.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea B',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await session.store.getState().load();
  });
  expect(collectAmbientSuggestions(session.store.getState().snapshot!).map((suggestion)=>suggestion.kind)).toContain('shared-slot');
  await user.click(within(dialog).getByRole('tab',{name:/Sugerencias/}));
  expect(within(dialog).getByText('Tareas en el mismo horario')).toBeInTheDocument();
  expect(session.notifications.getState().items.some((item)=>/nueva sugerencia/i.test(item.message))).toBe(false);
  expect(session.notifications.getState().items).toHaveLength(noticesBefore);
});

it('un error real al guardar la revisión sigue anunciándose como error',async()=>{
  const {session,user,dialog}=await open();
  await user.type(within(dialog).getByRole('textbox',{name:'Tareas para revisar'}),'Revisar tarea con error');
  await user.click(within(dialog).getByRole('button',{name:'Pasar a revisión'}));
  const card=within(dialog).getByRole('group',{name:/Tarea 1 · Pendiente de aprobación/});
  await user.selectOptions(within(card).getByRole('combobox',{name:'Lista'}),'bed-1');
  fireEvent.change(within(card).getByLabelText('Fecha'),{target:{value:'2026-11-07'}});
  fireEvent.change(within(card).getByLabelText('Hora'),{target:{value:'15:00'}});
  session.port.failNext('error');
  await user.click(within(card).getByRole('button',{name:'Aprobar y guardar'}));
  await waitFor(()=>expect(session.notifications.getState().items.some((item)=>item.kind==='error'&&/Fallo simulado/.test(item.message))).toBe(true));
  expect(session.store.getState().snapshot!.tasks.some((task)=>task.title==='Revisar tarea con error')).toBe(false);
});

async function sharedSlot(session: ReturnType<typeof createSession>) {
  await act(async()=>{
    await session.port.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea A',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await session.port.createReviewedTask({shiftId:'demo-shift-1',title:'Revisar tarea B',bedId:'bed-1',date:'2026-11-07',time:'15:00',beforeClose:false});
    await session.store.getState().load();
  });
}
async function editTask(session: ReturnType<typeof createSession>, title: string, patch: Record<string, unknown>) {
  const task=(await session.port.load()).tasks.find((item)=>item.title===title)!;
  await act(async()=>{
    await session.port.saveTask({...task,...patch});
    await session.store.getState().load();
  });
}
const sharedVisible = (dialog: HTMLElement) => within(dialog).queryByText('Tareas en el mismo horario');

it('R1b-T02: una sugerencia descartada no vuelve si el mismo hecho se guarda otra vez',async()=>{
  const {session,user,dialog}=await open();
  await sharedSlot(session);
  await user.click(within(dialog).getByRole('tab',{name:/Sugerencias/}));
  expect(sharedVisible(dialog)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button',{name:'Descartar'}));
  expect(sharedVisible(dialog)).not.toBeInTheDocument();
  await editTask(session,'Revisar tarea A',{});
  expect(sharedVisible(dialog)).not.toBeInTheDocument();
  await editTask(session,'Revisar tarea B',{});
  expect(sharedVisible(dialog)).not.toBeInTheDocument();
});

it('R1b-T03: cambiar la condición caduca la sugerencia; recrear la misma coincidencia la muestra otra vez',async()=>{
  const {session,user,dialog}=await open();
  await sharedSlot(session);
  await user.click(within(dialog).getByRole('tab',{name:/Sugerencias/}));
  await user.click(within(dialog).getByRole('button',{name:'Descartar'}));
  await editTask(session,'Revisar tarea A',{time:'16:00'});
  expect(sharedVisible(dialog)).not.toBeInTheDocument();
  await editTask(session,'Revisar tarea A',{time:'15:00'});
  expect(sharedVisible(dialog)).toBeInTheDocument();
});

it('R1b-T03: completar una tarea o cerrar la jornada retira la sugerencia',async()=>{
  const {session,user,dialog}=await open();
  await sharedSlot(session);
  await user.click(within(dialog).getByRole('tab',{name:/Sugerencias/}));
  expect(sharedVisible(dialog)).toBeInTheDocument();
  await editTask(session,'Revisar tarea A',{completed:true});
  expect(sharedVisible(dialog)).not.toBeInTheDocument();
  await act(async()=>{
    await session.port.closeShift('demo-shift-1');
    await session.store.getState().load();
  });
  expect(collectAmbientSuggestions(session.store.getState().snapshot!)).toHaveLength(0);
});

it('R1b-T04: una sugerencia nueva no roba el foco ni agrega avisos con el diálogo cerrado',async()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:1440});
  const session=createSession({port:createPreviewAdapter({delay:0}),random:()=>0}); sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const trigger=screen.getByRole('button',{name:'Abrir captura de tareas'});
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  const noticesBefore=session.notifications.getState().items.length;
  await sharedSlot(session);
  expect(screen.queryByRole('dialog',{name:'Captura y sugerencias'})).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
  expect(session.notifications.getState().items).toHaveLength(noticesBefore);
  expect(screen.getByRole('button',{name:'Abrir captura de tareas'})).toBe(trigger);
});
