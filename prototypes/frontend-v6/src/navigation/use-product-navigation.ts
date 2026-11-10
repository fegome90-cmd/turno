import {useEffect, useRef} from 'react';
import type {TurnoStore} from '../app/store';
import type {Route, Selection} from '../domain/types';
import {resolveReturnFocus, useOverlays} from '../components/OverlayCoordinator';
import {useHistory} from './use-history';

const HOME: Route = {view: 'home', selected: null, archiveId: null};
const sameSelection = (a: Selection, b: Selection) => a?.kind === b?.kind && a?.id === b?.id;
export type ProductIntent = {version: number; revision: number; selection: Selection};
type Pending = ProductIntent & {resume(): void; focusKey: string | null};
type Continuation = {version: number; revision: number; selection: Selection; action(): void};

export function useProductNavigation(store: TurnoStore, {onInvalid, onNewIntent}: {onInvalid(): void; onNewIntent(): void}) {
  const overlays = useOverlays();
  const version = useRef(0);
  const alive = useRef(true);
  const pending = useRef<Pending | null>(null);
  const afterClose = useRef<Continuation | null>(null);
  const closing = useRef<string | null>(null);
  const readRoute = (): Route => ({view: store.getState().view, selected: store.getState().selection, archiveId: store.getState().archiveId});
  const isCurrent = (intent: {version: number; revision: number; selection: Selection}) => alive.current && intent.version === version.current
    && intent.revision === store.getState().draftRevision && sameSelection(intent.selection, store.getState().selection);
  const currentContinuation = (action: () => void): Continuation => ({action, version: version.current, revision: store.getState().draftRevision, selection: store.getState().selection});
  const restoreOrigin = (key: string | null) => {
    if (document.activeElement !== document.body) return;
    const state = store.getState(), intent = {version: version.current, revision: state.draftRevision, selection: state.selection};
    const main = document.getElementById('main'), target = resolveReturnFocus(key) || main;
    // A persistent nonmodal portal needs an outside focus origin to restore its
    // tab order after the previous modal has already released focus to body.
    if (target?.closest('[data-panel-mode="column"]') && main && main !== target && !main.closest('[hidden],[inert]')) {
      const style = getComputedStyle(main);
      if (style.display !== 'none' && style.visibility !== 'hidden') main.focus({preventScroll: true});
      if (!isCurrent(intent) || (document.activeElement !== main && document.activeElement !== document.body) || resolveReturnFocus(key) !== target) return;
    }
    target?.focus();
  };
  const closeLayer = (id: string) => {closing.current = id; overlays.close(id);};
  const ask = (resume: () => void, origin?: string | null) => {
    const state = store.getState();
    const focusKey = origin === undefined ? (document.activeElement as HTMLElement | null)?.dataset.focusKey ?? null : origin;
    pending.current = {version: version.current, revision: state.draftRevision, selection: state.selection, resume, focusKey};
    overlays.open({id: 'unsaved-changes', kind: 'confirm', returnFocusKey: focusKey});
  };
  const controller = useHistory({
    history: window.history,
    subscribePopState(listener) {
      const onPop = (event: PopStateEvent) => listener(event.state);
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    },
    readRoute,
    applyRoute(route) {
      const state = store.getState();
      const selected = route.view === 'home' || route.view === 'archive' ? null : route.selected;
      const exists = selected?.kind === 'task' ? state.snapshot?.tasks.some((task) => task.id === selected.id)
        : selected?.kind === 'note' ? state.snapshot?.notes.some((note) => note.id === selected.id) : false;
      state.setArchiveId(route.archiveId); state.select(exists ? selected : null); state.setView(route.view);
      const appliedVersion = version.current;
      queueMicrotask(() => {
        if (alive.current && version.current === appliedVersion && document.activeElement === document.body) document.getElementById('main')?.focus();
      });
    },
    guardNavigation(_target, resume) {
      if (store.getState().busy || closing.current) return 'blocked';
      const cancelledOrigin = pending.current?.focusKey ?? null;
      version.current += 1; onNewIntent(); pending.current = null; afterClose.current = null;
      const top = store.getState().overlays.layers.at(-1);
      if (top) {
        if (top.id === 'unsaved-changes' || top.id === 'domain-dialog') afterClose.current = currentContinuation(() => restoreOrigin(top.id === 'domain-dialog' ? top.returnFocusKey : cancelledOrigin));
        if (top.id === 'navigation' || top.id === 'time' || top.id === 'unsaved-changes' || top.id === 'domain-dialog') closeLayer(top.id);
        else overlays.closeTop();
        return 'blocked';
      }
      if (!store.getState().dirty) return 'allow';
      ask(resume); return 'pending';
    },
    setTitle(route) {
      const state = store.getState();
      const current = sameSelection(route.selected, state.selection) ? state.draft?.title : undefined;
      const name = route.view === 'home' ? 'Inicio' : route.view === 'archive' ? 'Turnos anteriores'
        : current ?? (route.view === 'notes' ? 'Notas rápidas' : state.snapshot?.shifts.find((shift) => shift.id === (route.archiveId || state.snapshot?.activeShiftId))?.label ?? 'Turno');
      document.title = `${name} · Turno`;
    },
  });
  const invalidate = () => {
    version.current += 1; pending.current = null; afterClose.current = null;
    controller.cancelPending(); onNewIntent();
  };
  const begin = (action: () => void) => {
    if (!alive.current || store.getState().busy) return;
    invalidate();
    if (closing.current) {afterClose.current = currentContinuation(action); return;}
    const top = store.getState().overlays.layers.at(-1);
    if (top?.id === 'navigation' || top?.id === 'time' || top?.id === 'unsaved-changes' || top?.id === 'domain-dialog') {
      afterClose.current = currentContinuation(action); closeLayer(top.id); return;
    }
    if (top) overlays.close(top.id);
    action();
  };
  const closed = (id: string) => {
    if (closing.current !== id) return;
    closing.current = null;
    const continuation = afterClose.current; afterClose.current = null;
    // Release the public modal close-complete boundary before another route or focus owner starts.
    queueMicrotask(() => {if (continuation && isCurrent(continuation)) continuation.action();});
  };
  const requestRoute = (route: Route) => begin(() => controller.push(route));
  const complete = async (id: string, completed: boolean, key: string | null) => {
    const operationVersion = version.current;
    await store.getState().setCompleted(id, completed);
    queueMicrotask(() => {
      if (!alive.current || version.current !== operationVersion || document.activeElement !== document.body) return;
      restoreOrigin(key);
    });
  };
  const requestCompletion = (id: string, completed: boolean) => {
    const key = (document.activeElement as HTMLElement | null)?.dataset.focusKey ?? null;
    begin(() => {
      const action = () => {void complete(id, completed, key);};
      if (store.getState().dirty) ask(action); else action();
    });
  };
  const cancel = () => {
    if (!alive.current || store.getState().busy) return;
    const key = pending.current?.focusKey ?? null; invalidate();
    afterClose.current = currentContinuation(() => restoreOrigin(key)); closeLayer('unsaved-changes');
  };
  const discard = () => {
    const decision = pending.current;
    if (!decision || !isCurrent(decision) || store.getState().busy) return;
    store.getState().cancelDraft(); pending.current = null;
    afterClose.current = currentContinuation(decision.resume); closeLayer('unsaved-changes');
  };
  const save = async () => {
    const decision = pending.current;
    if (!decision || !isCurrent(decision) || store.getState().busy) return;
    const result = decision.selection?.kind === 'note' ? await store.getState().saveNote() : await store.getState().saveTask();
    if (!isCurrent(decision) || pending.current !== decision) return;
    pending.current = null;
    if (result.status === 'saved' && result.appliedToDraft && result.revision === decision.revision && sameSelection(result.selection, decision.selection)) {
      afterClose.current = currentContinuation(decision.resume);
    } else {
      controller.cancelPending();
      afterClose.current = currentContinuation(result.status === 'invalid' ? onInvalid : () => restoreOrigin(decision.focusKey));
    }
    closeLayer('unsaved-changes');
  };
  useEffect(() => {
    alive.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {if (store.getState().dirty) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      alive.current = false; version.current += 1; pending.current = null; afterClose.current = null; closing.current = null; controller.cancelPending();
    };
  }, [store, controller]);
  return {
    intentVersion: () => version.current,
    beforeEdit: () => {invalidate(); if (store.getState().overlays.layers.some((layer) => layer.id === 'unsaved-changes')) closeLayer('unsaved-changes');},
    captureIntent: (): ProductIntent => ({version: version.current, revision: store.getState().draftRevision, selection: store.getState().selection}),
    isCurrentIntent: isCurrent,
    requestAction: (action: () => void, origin?: string | null) => begin(() => {if (store.getState().dirty) ask(action, origin); else action();}),
    dismissDomain: (origin: string | null) => {
      if (!alive.current || store.getState().busy) return;
      invalidate(); afterClose.current = currentContinuation(() => restoreOrigin(origin)); closeLayer('domain-dialog');
    },
    requestRoute, requestCompletion,
    home: () => requestRoute(HOME),
    openShift: () => {const first = store.getState().snapshot?.tasks.find((task) => task.shiftId === store.getState().snapshot?.activeShiftId); requestRoute({view: 'workspace', selected: first ? {kind: 'task', id: first.id} : null, archiveId: null});},
    notes: () => {const first = store.getState().snapshot?.notes[0]; requestRoute({view: 'notes', selected: first ? {kind: 'note', id: first.id} : null, archiveId: null});},
    archive: () => requestRoute({view: 'archive', selected: null, archiveId: null}),
    openArchive: (id: string) => {
      const snapshot = store.getState().snapshot;
      if (!snapshot?.shifts.some((shift) => shift.id === id && shift.status === 'closed')) return;
      const first = snapshot.tasks.find((task) => task.shiftId === id);
      requestRoute({view: 'workspace', selected: first ? {kind: 'task', id: first.id} : null, archiveId: id});
    },
    select: (selection: NonNullable<Selection>) => {
      const snapshot = store.getState().snapshot, task = selection.kind === 'task' ? snapshot?.tasks.find((item) => item.id === selection.id) : undefined;
      const owner = snapshot?.shifts.find((shift) => shift.id === task?.shiftId);
      requestRoute({view: selection.kind === 'note' ? 'notes' : 'workspace', selected: selection, archiveId: owner?.status === 'closed' ? owner.id : null});
    },
    cancel, discard, save,
    panelClosed: closed, dialogClosed: () => closed('unsaved-changes'),
  };
}
