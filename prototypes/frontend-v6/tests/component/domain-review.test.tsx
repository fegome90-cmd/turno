import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((s) => s.dispose()); vi.restoreAllMocks();});
async function setup() {
 Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:1440}); window.history.replaceState(null,'');
 const session=createSession({random:()=>0,port:createPreviewAdapter({delay:0})}); sessions.push(session); await session.store.getState().load();
 const view=render(<AppProviders><App session={session}/></AppProviders>); const user=userEvent.setup();
 await user.click(within(screen.getByRole('navigation')).getByRole('button',{name:'Ir al turno actual'}));
 return {session,user,...view};
}
function controlledHistory() {
 const entries:unknown[]=[null],events:unknown[]=[]; let index=0;
 const move=(delta:number)=>{const next=index+delta;if(next<0||next>=entries.length)return;index=next;events.push(entries[index]);};
 vi.spyOn(window.history,'state','get').mockImplementation(()=>entries[index]);
 vi.spyOn(window.history,'replaceState').mockImplementation(data=>{entries[index]=structuredClone(data);});
 const push=vi.spyOn(window.history,'pushState').mockImplementation(data=>{entries.splice(index+1);entries.push(structuredClone(data));index++;});
 vi.spyOn(window.history,'go').mockImplementation((delta=0)=>move(delta));
 return {entries,push,move,get index(){return index;},flush(){let n=0;while(events.length){if(++n>30)throw Error('loop');window.dispatchEvent(new PopStateEvent('popstate',{state:events.shift()}));}}};
}
describe('Independent T2 review',()=>{
 it('Cancel Start from desktop navigation returns focus to that initiating navigation control',async()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:1440}); window.history.replaceState(null,'');
  const session=createSession({random:()=>0,port:createPreviewAdapter({delay:0})});sessions.push(session);
  await session.port.closeShift('demo-shift-1');await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);const user=userEvent.setup();
  const entry=within(screen.getByRole('navigation')).getByRole('button',{name:'Iniciar turno'});
  await user.click(entry);const modal=screen.getByRole('dialog',{name:'Iniciar turno'});
  await user.click(within(modal).getByRole('button',{name:'Cancelar'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Iniciar turno'})).not.toBeInTheDocument());
  await waitFor(()=>expect(entry).toHaveFocus());
 });

 it('creating a list on the unchanged route restores a useful visible focus instead of leaving body',async()=>{
  const {user,session}=await setup(); const push=vi.spyOn(window.history,'pushState'),pushCount=push.mock.calls.length; const entry=screen.getByRole('button',{name:'Agregar lista'}); await user.click(entry);
  const modal=screen.getByRole('dialog',{name:'Agregar lista'}); await user.type(within(modal).getByRole('textbox',{name:'Nombre de lista'}),'Lista nueva foco');
  await user.click(within(modal).getByRole('button',{name:'Crear'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Agregar lista'})).not.toBeInTheDocument());
  expect(session.store.getState().snapshot!.beds).toHaveLength(3);
  await waitFor(()=>expect(entry).toHaveFocus());expect(push).toHaveBeenCalledTimes(pushCount);
 });
 it.each([-1,1])('Back/Forward %s dismisses rename only and retains route/index/Forward, then subsequent traversal works',async(direction)=>{
  const h=controlledHistory(); const {user,session}=await setup();
  await user.click(screen.getByRole('button',{name:'Revisar insumos'})); act(()=>{h.move(-1);h.flush();});
  expect(h.index).toBe(1); const entry=screen.getByRole('button',{name:'Editar nombre de Lista 1'}); await user.click(entry);
  const modal=screen.getByRole('dialog',{name:'Editar nombre de lista'}); const field=within(modal).getByRole('textbox',{name:'Nombre de la lista'});
  await user.clear(field);await user.type(field,'No confirmado'); const pushes=h.push.mock.calls.length;
  act(()=>{h.move(direction);h.flush();});
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Editar nombre de lista'})).not.toBeInTheDocument());
  expect(session.store.getState().selection).toEqual({kind:'task',id:'task-1'}); expect(h.index).toBe(1);expect(h.entries).toHaveLength(3);expect(h.push).toHaveBeenCalledTimes(pushes);
  expect(session.store.getState().snapshot!.beds[0]!.label).toBe('Lista 1');
  act(()=>{h.move(direction);h.flush();}); expect(h.index).toBe(1+direction);
 });
 it('a newer editor revision during held creation preserves draft and prevents stale entity selection',async()=>{
  const {user,session}=await setup(); await user.click(screen.getByRole('button',{name:'Agregar tarea a Lista 1'})); const modal=screen.getByRole('dialog',{name:'Agregar tarea'});
  await user.type(within(modal).getByRole('textbox',{name:'Título de tarea nueva'}),'Confirmada pero no seleccionada');
  let release!:()=>void;const held=new Promise<void>(r=>release=r),actual=session.port.createTask.bind(session.port);
  vi.spyOn(session.port,'createTask').mockImplementation(async(...args)=>{await held;return actual(...args);});
  await user.click(within(modal).getByRole('button',{name:'Crear'}));act(()=>session.store.getState().setDraftField('body','Intención nueva'));
  await act(async()=>{release();});await waitFor(()=>expect(session.store.getState().busy).toBe(false));
  expect(session.store.getState().snapshot!.tasks).toHaveLength(5);expect(session.store.getState().selection).toEqual({kind:'task',id:'task-1'});expect(session.store.getState().draft?.body).toBe('Intención nueva');expect(modal).toBeInTheDocument();
 });
 it('after a cancelled domain form a newer external focus is not stolen by return delivery',async()=>{
  const {user}=await setup();await user.click(screen.getByRole('button',{name:'Editar nombre de Lista 1'})); const modal=screen.getByRole('dialog',{name:'Editar nombre de lista'});
  const outside=document.createElement('button');outside.textContent='Nuevo foco externo';document.body.append(outside);
  try{act(()=>{fireEvent.click(within(modal).getByRole('button',{name:'Cancelar'}));outside.focus();});
   await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Editar nombre de lista'})).not.toBeInTheDocument());expect(outside).toHaveFocus();
  }finally{outside.remove();}
 });
});
