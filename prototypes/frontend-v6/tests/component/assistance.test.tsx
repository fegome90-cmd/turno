// Integración del frontend React v6, puerto existente y revisión humana; no se simula un LLM.
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
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
