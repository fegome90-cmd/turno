// Technical 3A fixture. Slots exercise native editing/docking, not TaskEditor/TimePanel/Agenda.
import {useRef, useState} from 'react';
import {useStore} from 'zustand';
import {Dialog} from '@base-ui/react/dialog';
import type {AppSession} from '../app/create-session';
import {AppShell} from '../components/AppShell';
import {Navigation} from '../components/Navigation';
import {DemoDialog} from '../components/DemoDialog';
import {TemporalField} from '../components/TemporalField';
import {useOverlays, resolveReturnFocus} from '../components/OverlayCoordinator';
import {useHistory} from '../navigation/use-history';
import type {Route} from '../domain/types';

export function LayoutHarness({session}: {session: AppSession}) {
  const state = useStore(session.store);
  const overlays = useOverlays();
  const [title, setTitle] = useState('Título técnico');
  const [body, setBody] = useState('Texto literal <sin interpretar>\nSegunda línea');
  const [estimate, setEstimate] = useState('');
  const [property, setProperty] = useState(true);
  const [saved, setSaved] = useState(0);
  const [fullscreenError, setFullscreenError] = useState('');
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else if (typeof document.documentElement.requestFullscreen === 'function') await document.documentElement.requestFullscreen();
      else setFullscreenError('Pantalla completa no está disponible. Puedes seguir trabajando.');
    } catch {setFullscreenError('No se pudo abrir pantalla completa. Puedes seguir trabajando.');}
  };
  const composing = useRef(false);
  const route = (): Route => {const current = session.store.getState(); return {view: current.view, selected: current.selection, archiveId: null};};
  const controller = useHistory({
    history: window.history,
    subscribePopState(listener) {
      const handler = (event: PopStateEvent) => listener(event.state);
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    },
    readRoute: route,
    applyRoute(next) {session.store.getState().setView(next.view);},
    guardNavigation() {
      if (overlays.state.layers.length) {overlays.closeTop(); return 'blocked';}
      return 'allow';
    },
    setTitle() {document.title = 'Layout · harness técnico 3A · Turno';},
  });
  const edit = (callback: () => void) => {controller.cancelPending(); callback();};
  const editor = <main id="main" tabIndex={-1} className="editor-slot layout-harness">
    <h1>Layout · ensayo técnico 3A</h1><p>No es el editor ni la Agenda integrados. Solo datos sintéticos, en memoria.</p>
    <div className="harness-controls"><button onClick={() => controller.push({view: 'home', selected: null, archiveId: null})}>Ensayar Inicio</button><button onClick={() => controller.push({view: 'workspace', selected: null, archiveId: null})}>Ensayar espacio</button></div>
    <label htmlFor="technical-title">Título técnico</label><input id="technical-title" value={title} onChange={(event) => edit(() => setTitle(event.target.value))} onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}} onKeyDown={(event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composing.current) return;
      event.preventDefault(); setSaved((count) => count + 1);
    }}/>
    <label htmlFor="technical-body">Borrador técnico</label><textarea id="technical-body" data-focus-key="technical-body" value={body} onChange={(event) => edit(() => setBody(event.target.value))}/>
    <button onClick={() => overlays.open({id: 'technical-confirm', kind: 'confirm', returnFocusKey: 'technical-body'})}>Abrir confirmación técnica</button>
    <button onClick={() => {void fullscreen();}}>Pantalla completa de ensayo</button>
    {fullscreenError && <p role="status" aria-label="Estado de pantalla completa">{fullscreenError}</p>}
    <output aria-label="Guardados técnicos">{saved}</output>
    <p className="slot-boundary">Solo contrato técnico EXTRA-NATIVE-EDIT. Las identidades integradas siguen pendientes de las fases 4A–5A.</p>
  </main>;
  const timePanel = <section className="time-slot technical-time"><h2>Propiedades técnicas</h2>
    <button aria-expanded={property} aria-controls="technical-property" onClick={() => setProperty(!property)}>Tiempo de ensayo</button>
    <div id="technical-property" hidden={!property}><TemporalField id="technical-estimate" label="Estimación técnica" kind="minutes" value={estimate} onValueChange={(value) => edit(() => setEstimate(value))}/></div>
    <div className="technical-scroll" tabIndex={0} aria-label="Contenido desplazable de ensayo">{Array.from({length: 30}, (_, index) => <p key={index}>Contenido técnico {index + 1}</p>)}</div>
  </section>;
  return <>
    <AppShell navigation={<Navigation store={session.store}/>} editor={editor} timePanel={timePanel} view={state.view} title={state.snapshot?.beds[0]?.label ?? 'Ensayo técnico'} inspectorHidden={state.inspectorHidden} onInspectorHidden={state.setInspectorHidden}/>
    <DemoDialog port={session.port}/>
    <Dialog.Root open={overlays.state.layers.some((layer) => layer.id === 'technical-confirm')} onOpenChange={(open, details) => {
      if (!open && overlays.state.layers.at(-1)?.id === 'technical-confirm') overlays.closeTop(); else if (!open) details.cancel();
    }}><Dialog.Portal><Dialog.Backdrop className="overlay-backdrop"/><Dialog.Popup className="demo-dialog" finalFocus={() => resolveReturnFocus('technical-body')}>
      <Dialog.Title>Confirmación técnica</Dialog.Title><Dialog.Description>Solo comprueba la capa durante cambios de ancho. No guarda ni descarta tareas.</Dialog.Description><Dialog.Close>Volver al ensayo</Dialog.Close>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  </>;
}
