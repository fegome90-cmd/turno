// Technical controller fixture, not a substitute for TaskEditor/Agenda/BedDialogs or product integration.
import {useEffect, useRef, useState} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import {useHistory} from '../navigation/use-history';
import {useOverlays, resolveReturnFocus} from '../components/OverlayCoordinator';
import type {Route} from '../domain/types';

const HOME: Route = {view: 'home', selected: null, archiveId: null};
const taskRoute = (id: string): Route => ({view: 'workspace', selected: {kind: 'task', id}, archiveId: null});
const initialTitle = (route: Route) => route.selected?.id === 'task-1' ? 'Tarea 1' : 'Revisar insumos';

export function HistoryHarness() {
  const [route, setRoute] = useState(HOME);
  const routeRef = useRef(route);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('Tarea 1');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [paint, setPaint] = useState(0);
  const revision = useRef(0);
  const saveGeneration = useRef(0);
  const pending = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);
  const finishSave = useRef<((ok: boolean) => void) | null>(null);
  const overlays = useOverlays();
  const top = overlays.state.layers.at(-1);
  const returnFocus = useRef<{key: string | null; revision: number}>({key: null, revision: 0});
  useEffect(() => { if (top) returnFocus.current = {key: top.returnFocusKey, revision: revision.current}; }, [top]);
  const controller = useHistory({
    history: window.history,
    subscribePopState(listener) {
      const onPop = (event: PopStateEvent) => listener(event.state);
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    },
    readRoute: () => routeRef.current,
    applyRoute(next) {
      routeRef.current = next; setRoute(next);
      revision.current++; setDirty(false); setBody(''); setTitle(initialTitle(next)); setError('');
    },
    guardNavigation(_target, resume) {
      if (busy || closing.current) return 'blocked';
      if (top) {
        pending.current = null; afterClose.current = null; closing.current = true;
        overlays.closeTop(); return 'blocked';
      }
      if (!dirty) return 'allow';
      pending.current = resume;
      overlays.open({id: 'history-confirm', kind: 'confirm', returnFocusKey: 'history-body'});
      return 'pending';
    },
    setTitle(next) {
      document.title = `${next.view === 'home' ? 'Inicio' : next.selected?.id === route.selected?.id ? title : initialTitle(next)} · Turno`;
    },
  });
  const close = () => {
    pending.current = null;
    afterClose.current = null;
    closing.current = true;
    // A cancelled asynchronous decision cannot later resume, even if the route has not changed.
    saveGeneration.current++;
    controller.push(routeRef.current);
    setBusy(false); overlays.closeTop();
  };
  const discard = () => {
    const resume = pending.current; pending.current = null;
    afterClose.current = resume; closing.current = true;
    setDirty(false); overlays.closeTop();
  };
  const save = () => {
    if (busy) return;
    const savedRevision = revision.current;
    const generation = ++saveGeneration.current;
    const resume = pending.current;
    setBusy(true); setSavePending(true);
    // Controlled completion, deliberately NOT store.saveTask(): Promise<void> cannot prove success.
    finishSave.current = (ok) => {
      finishSave.current = null; setSavePending(false);
      if (savedRevision !== revision.current || generation !== saveGeneration.current) return;
      setBusy(false);
      if (!ok) { setError('Fallo simulado. El borrador se conserva.'); return; }
      pending.current = null; afterClose.current = resume; closing.current = true;
      setDirty(false); overlays.close('history-confirm');
    };
  };
  const resolve = (ok: boolean) => finishSave.current?.(ok);
  return <main style={{maxWidth: 850, margin: '2rem auto', padding: '1rem'}}>
    <h1>Historial y guardas · harness técnico 2B</h1>
    <p>No es el producto integrado. Solo datos sintéticos, en memoria.</p>
    <nav aria-label="Rutas de prueba">
      <button onClick={() => controller.push(HOME)}>Inicio</button>
      <button onClick={() => controller.push(taskRoute('task-1'))}>Tarea 1</button>
      <button onClick={() => controller.push(taskRoute('task-2'))}>Tarea 2</button>
    </nav>
    <p data-testid="route">{route.view}:{route.selected?.id ?? ''}</p>
    <p data-testid="index">{typeof window.history.state?.idx === 'number' ? window.history.state.idx : 'exterior'}</p>
    {route.view === 'home' ? <h2>Inicio</h2> : <section aria-label="Edición técnica">
      <label>Título<input value={title} onChange={(e) => { revision.current++; setTitle(e.target.value); setDirty(true); }} /></label>
      <label>Borrador<textarea data-focus-key="history-body" value={body} onChange={(e) => { revision.current++; setBody(e.target.value); setDirty(true); }} /></label>
    </section>}
    <button data-focus-key="history-more" onClick={() => overlays.open({id: 'history-more', kind: 'more', returnFocusKey: 'history-more'})}>Más opciones de prueba</button>
    <button onClick={() => setBusy((value) => !value)}>Alternar busy</button>
    <button onClick={() => setPaint((n) => n + 1)}>Render sin navegar</button>
    <output aria-label="Estado">{busy ? 'busy' : dirty ? 'dirty' : 'clean'}:{paint}</output>
    {savePending && !top && <button onClick={() => resolve(true)}>Resolver respuesta antigua</button>}
    {!top && <p role="alert">{error}</p>}
    <Dialog.Root open={!!top} onOpenChange={(open) => { if (!open) close(); }} onOpenChangeComplete={(open) => {
      if (open) return;
      closing.current = false;
      const resume = afterClose.current; afterClose.current = null;
      // The public close-complete boundary releases Base UI's modal focus owner. Resume after
      // its synchronous unmount/cleanup, not while a newly editable route can still be trapped.
      queueMicrotask(() => resume?.());
    }}>
      <Dialog.Portal><Dialog.Backdrop />
        <Dialog.Popup finalFocus={() => returnFocus.current.revision === revision.current ? resolveReturnFocus(returnFocus.current.key) : false} style={{position: 'fixed', inset: '20% 20% auto', background: 'var(--canvas)', padding: '2rem', border: '1px solid'}}>
          <Dialog.Title>{top?.kind === 'confirm' ? 'Cambios sin guardar' : 'Opciones de prueba'}</Dialog.Title>
          <Dialog.Description>El historial permanece en la ruta actual hasta decidir.</Dialog.Description>
          <p role="alert">{error}</p>
          <button onClick={close}>Volver</button>
          {top?.kind === 'confirm' && <>
            <button disabled={busy} onClick={discard}>Descartar</button>
            <button disabled={busy} onClick={save}>Guardar y continuar</button>
            {busy && <><button onClick={() => resolve(true)}>Resolver éxito</button><button onClick={() => resolve(false)}>Resolver fallo</button></>}
          </>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </main>;
}
