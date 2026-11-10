// Local 4A product integration; phase acceptance still requires fresh browser evidence and independent review.
import {useStore} from 'zustand';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {AppSession} from './create-session';
import {AppShell} from '../components/AppShell';
import {Navigation} from '../components/Navigation';
import {DemoDialog} from '../components/DemoDialog';
import {Home} from '../components/Home';
import {OverlayProvider, resolveReturnFocus, useOverlays} from '../components/OverlayCoordinator';
import {TaskEditor} from '../components/TaskEditor';
import {NoteEditor} from '../components/NoteEditor';
import {TimePanel} from '../components/TimePanel';
import {Agenda} from '../components/Agenda';
import {UnsavedChangesDialog} from '../components/UnsavedChangesDialog';
import {useProductNavigation} from '../navigation/use-product-navigation';
import type {FieldFocusRequest} from '../components/EditorForm';
import {CloseShiftDialog, DomainNameDialog} from '../components/ShiftDialogs';
import {Archive} from 'lucide-react';
import {displayDate} from '../domain/format';
import type {DomainResult} from './store';
import {ProductNotifications} from '../notifications/ProductNotifications';
import {AssistanceDialog, type AssistanceTab} from '../components/AssistanceDialog';
import {collectAmbientSuggestions} from '../ambient/review';

type CloseRequest = {key: number; shiftId: string; origin: string | null};
type NameKind = 'task' | 'bed' | 'note' | 'shift' | 'rename';
type NameRequest = {key: number; kind: NameKind; bedId: string | null; initial: string; origin: string | null};
const NAME_CONFIG = {
  task: {title: 'Agregar tarea', label: 'Título de tarea nueva', action: 'Crear'},
  bed: {title: 'Agregar lista', label: 'Nombre de lista', action: 'Crear'},
  note: {title: 'Nueva nota rápida', label: 'Título de nota nueva', action: 'Crear'},
  shift: {title: 'Iniciar turno', label: 'Nombre del turno', action: 'Iniciar'},
  rename: {title: 'Editar nombre de lista', label: 'Nombre de la lista', action: 'Guardar nombre'},
} as const;

export function App({session}: {session: AppSession}) {
  return <OverlayProvider store={session.store}><ProductApp session={session}/><ProductNotifications session={session}/></OverlayProvider>;
}

function ProductApp({session}: {session: AppSession}) {
  const state = useStore(session.store);
  const overlays = useOverlays();
  const [assistanceTab, setAssistanceTab] = useState<AssistanceTab>('capture');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const allSuggestions = collectAmbientSuggestions(state.snapshot);
  const visibleSuggestions = allSuggestions.filter((suggestion) => !dismissedSuggestions.includes(suggestion.id));
  const previousSuggestionIds = useRef<string[] | null>(null);
  useEffect(() => {
    if (!state.snapshot) return;
    const ids = collectAmbientSuggestions(state.snapshot).map((suggestion) => suggestion.id);
    if (previousSuggestionIds.current !== null && ids.some((id) => !previousSuggestionIds.current!.includes(id))) {
      session.notifications.notify('Hay una nueva sugerencia de organización para revisar.', 'status');
    }
    previousSuggestionIds.current = ids;
  }, [state.snapshot, session.notifications]);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [closeRequest, setCloseRequest] = useState<CloseRequest | null>(null), [closeError, setCloseError] = useState('');
  const closeCurrent = useRef<CloseRequest | null>(null);
  useLayoutEffect(() => {closeCurrent.current = closeRequest;}, [closeRequest]);
  const nameSequence = useRef(0), nameCurrent = useRef<NameRequest | null>(null);
  useLayoutEffect(() => {nameCurrent.current = nameRequest;}, [nameRequest]);
  const invalid = useRef<(FieldFocusRequest & {key: string; intent: number}) | null>(null);
  const requestedFocus = (): HTMLElement | false => {
    const request = invalid.current;
    if (!request) return false;
    const current = session.store.getState();
    if (request.revision !== current.draftRevision || request.selection?.kind !== current.selection?.kind || request.selection?.id !== current.selection?.id || request.intent !== navigation.intentVersion()) {invalid.current = null; return false;}
    const target = resolveReturnFocus(`field-${request.key}`);
    const active = document.activeElement;
    if (active !== document.body && active !== request.origin && active !== target && request.origin?.isConnected) {invalid.current = null; return false;}
    if (target) invalid.current = null;
    return target;
  };
  const focusPending = () => {const target = requestedFocus(); if (target) target.focus();};
  const focusInvalid = (request?: FieldFocusRequest): void => {
    const current = session.store.getState();
    const source = request ?? {revision: current.draftRevision, selection: current.selection, origin: document.activeElement};
    if (source.revision !== current.draftRevision || source.selection?.kind !== current.selection?.kind || source.selection?.id !== current.selection?.id) return;
    const active = document.activeElement;
    if (active !== source.origin && active !== document.body && source.origin?.isConnected) return;
    const key = Object.keys(current.errors)[0];
    if (!key) return;
    invalid.current = {...source, key, intent: navigation.intentVersion()};
    if (key !== 'title' && key !== 'body') {
      current.setTimeTab('task'); current.setPropertyExpanded(key, true);
      if (window.innerWidth < 1000) overlays.open({id: 'time', kind: 'time', returnFocusKey: 'open-time'});
      else current.setInspectorHidden(false);
    } else queueMicrotask(focusPending);
  };
  const navigation = useProductNavigation(session.store, {onInvalid: () => focusInvalid(), onNewIntent: () => {invalid.current = null;}});
  const openAssistance = (tab: AssistanceTab, origin: string) => {
    navigation.requestAction(() => {
      setAssistanceTab(tab);
      overlays.open({id: 'assistance', kind: 'assistance', returnFocusKey: origin});
    }, origin);
  };
  const requestName = (kind: NameKind, bedId: string | null = null, focusKey: string | null = null) => {
    const layers = session.store.getState().overlays.layers;
    const origin = layers.some((layer) => layer.id === 'navigation') ? 'open-nav' : layers.some((layer) => layer.id === 'time') ? 'open-time' : focusKey;
    navigation.requestAction(() => {
      const current = session.store.getState(), snapshot = current.snapshot;
      const activeShift = snapshot?.shifts.find((shift) => shift.id === snapshot.activeShiftId && shift.status === 'open');
      if ((kind === 'task' || kind === 'bed') && !activeShift) return;
      if (kind === 'shift' && activeShift) return;
      const bed = snapshot?.beds.find((item) => item.id === bedId);
      if (kind === 'rename' && (!bed || current.archiveId || bed.shiftId !== activeShift?.id)) return;
      if (kind === 'task' && bedId && bed?.shiftId !== activeShift?.id) return;
      setNameRequest({key: ++nameSequence.current, kind, bedId, initial: kind === 'rename' ? bed!.label : '', origin});
      overlays.open({id: 'domain-dialog', kind: kind === 'rename' ? 'rename' : 'create', returnFocusKey: origin});
    }, origin);
  };
  const createTask = (bedId?: string | null, origin = 'create-task-global') => {
    const current = session.store.getState();
    const selected = current.selection?.kind === 'task' ? current.snapshot?.tasks.find((task) => task.id === current.selection?.id) : undefined;
    requestName('task', bedId === undefined ? current.archiveId ? null : selected?.bedId ?? null : bedId, origin);
  };
  const openShift = (origin = 'home-primary') => {
    if (session.store.getState().snapshot?.activeShiftId) navigation.openShift();
    else requestName('shift', null, origin);
  };
  const submitName = async (request: NameRequest, value: string): Promise<DomainResult<{id: string}>> => {
    if (nameCurrent.current !== request) return {status: 'busy'};
    const ticket = navigation.captureIntent(), current = session.store.getState();
    const result = request.kind === 'task' ? await current.createTask(value, request.bedId)
      : request.kind === 'bed' ? await current.createBed(value)
      : request.kind === 'note' ? await current.createNote(value)
      : request.kind === 'shift' ? await current.openShift(value)
      : await current.renameBed(request.bedId!, value);
    if (nameCurrent.current !== request || !navigation.isCurrentIntent(ticket)) return result;
    if (result.status === 'noop' || (result.status === 'saved' && request.kind === 'rename')) navigation.dismissDomain(request.origin);
    else if (result.status === 'saved') {
      const latest = session.store.getState();
      const expandedBed = request.kind === 'bed' ? result.entity.id : request.kind === 'task' ? request.bedId : null;
      if (expandedBed && !latest.expandedBeds.includes(expandedBed)) latest.toggleBed(expandedBed);
      const selected = request.kind === 'task' ? {kind: 'task' as const, id: result.entity.id}
        : request.kind === 'note' ? {kind: 'note' as const, id: result.entity.id}
        : request.kind === 'bed' && latest.selection?.kind === 'task' ? latest.selection : null;
      // Creating a list can leave the route unchanged. Use the same close/focus
      // boundary as rename instead of asking a no-op route to move focus.
      if (request.kind === 'bed' && latest.view === 'workspace' && !latest.archiveId && latest.selection?.kind !== 'note') navigation.dismissDomain(request.origin);
      else navigation.requestRoute({view: request.kind === 'note' ? 'notes' : 'workspace', selected, archiveId: null});
    }
    return result;
  };
  const requestClose = () => {
    const origin = session.store.getState().overlays.layers.some((layer) => layer.id === 'navigation') ? 'open-nav' : 'close-shift-toolbar';
    navigation.requestAction(() => {
      const snapshot = session.store.getState().snapshot, shift = snapshot?.shifts.find((item) => item.id === snapshot.activeShiftId && item.status === 'open');
      if (!shift) return;
      setCloseError(''); setCloseRequest({key: ++nameSequence.current, shiftId: shift.id, origin});
      overlays.open({id: 'domain-dialog', kind: 'confirm', returnFocusKey: origin});
    }, origin);
  };
  const submitClose = async (request: CloseRequest) => {
    if (closeCurrent.current !== request || session.store.getState().busy) return;
    const ticket = navigation.captureIntent(); setCloseError('');
    const result = await session.store.getState().closeShift(request.shiftId);
    if (closeCurrent.current !== request || !navigation.isCurrentIntent(ticket)) return;
    if (result.status === 'error') setCloseError(result.code === 'SIMULATED_CONFLICT' ? 'Conflicto simulado. El turno sigue abierto. Vuelve a pulsar «Cerrar y archivar».' : result.message);
    else if (result.status === 'saved') {
      const latest = session.store.getState();
      if (latest.view === 'home' && !latest.selection && !latest.archiveId) navigation.dismissDomain('home-primary');
      else navigation.home();
    }
  };
  useLayoutEffect(() => {
    if (window.innerWidth >= 1000 && !state.inspectorHidden) focusPending();
  });
  const pending = state.snapshot?.tasks.filter((task) => task.shiftId === state.snapshot?.activeShiftId && !task.completed).length ?? 0;
  const active = state.snapshot?.shifts.find((shift) => shift.id === state.snapshot?.activeShiftId);
  const shownShift = state.snapshot?.shifts.find((shift) => shift.id === (state.archiveId || state.snapshot?.activeShiftId));
  const selectedTask = state.selection?.kind === 'task' ? state.snapshot?.tasks.find((task) => task.id === state.selection?.id) : undefined;
  const selectedList = selectedTask ? state.snapshot?.beds.find((bed) => bed.id === selectedTask.bedId)?.label ?? 'Sin lista' : '';
  const title = state.view === 'home' ? '' : state.view === 'archive' ? 'Turnos anteriores' : state.view === 'notes' ? 'Notas rápidas' : selectedTask ? `${selectedList} / ${selectedTask.reason || 'Tareas'}` : shownShift?.label ?? 'Turno';
  const workspace = state.view === 'archive' ? <main id="main" tabIndex={-1} className="archive-view"><h1>Turnos anteriores</h1><p className="muted">Consulta de solo lectura. Los pendientes se conservan.</p><div className="archive-list">{state.snapshot?.shifts.filter((shift) => shift.status === 'closed').map((shift) => <button key={shift.id} type="button" className="archive-link" onClick={() => navigation.openArchive(shift.id)}><Archive size={20} aria-hidden="true"/><span>{shift.label} · {displayDate(shift.date)}</span></button>)}{!state.snapshot?.shifts.some((shift) => shift.status === 'closed') && <p className="empty">Todavía no hay turnos cerrados.</p>}</div></main> : state.draft?.kind === 'task' ? <TaskEditor key={state.draft.id} store={session.store} focusFirstInvalid={focusInvalid} beforeEdit={navigation.beforeEdit} onCreateTask={() => createTask(undefined, 'create-task-inline')}/> : state.draft?.kind === 'note' ? <NoteEditor key={state.draft.id} store={session.store} focusFirstInvalid={focusInvalid} beforeEdit={navigation.beforeEdit}/> : <main id="main" tabIndex={-1} className="editor-slot"><h1>{title || 'Turno'}</h1><p>{state.view === 'notes' ? 'Selecciona una nota o crea una nueva.' : 'Selecciona una tarea o agrega la primera.'}</p></main>;
  return <>
    <AppShell assistance={{onCapture: () => openAssistance('capture', 'open-capture'), onSuggestions: () => openAssistance('suggestions', 'open-suggestions'), suggestionCount: visibleSuggestions.length}} closeShift={{available: !!active, busy: state.busy, onClick: requestClose}} navigation={<Navigation store={session.store} actions={{...navigation, openShift, createTask, createBed: () => requestName('bed', null, 'create-bed'), renameBed: (id) => requestName('rename', id, 'rename-' + id), createNote: () => requestName('note', null, 'create-note')}}/>} view={state.view} title={title} inspectorHidden={state.inspectorHidden} onInspectorHidden={state.setInspectorHidden}
      editor={state.view === 'home' ? <Home preferredName={session.preferredName} subtitle={session.homeSubtitle} summary={{message: active ? `${active.label} · ${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}` : 'No hay un turno abierto.', actionLabel: active ? 'Ir al turno actual' : 'Iniciar turno'}} onOpenShift={() => openShift('home-primary')}/> : workspace}
      timePanel={<TimePanel store={session.store} beforeEdit={navigation.beforeEdit} agenda={<Agenda store={session.store} onSelect={(id) => navigation.select({kind: 'task', id})} onCreateTask={() => createTask(null, 'create-task-agenda')}/>}/>} timePanelOwnsHeading onTimeOpenComplete={focusPending} timeInitialFocus={requestedFocus} onPanelCloseComplete={navigation.panelClosed}/>
    {nameRequest && <DomainNameDialog {...NAME_CONFIG[nameRequest.kind]} initial={nameRequest.initial} rename={nameRequest.kind === 'rename'} requestKey={nameRequest.key} busy={state.busy}
      open={state.overlays.layers.some((layer) => layer.id === 'domain-dialog')} onEdit={navigation.beforeEdit}
      onSubmit={(value) => submitName(nameRequest, value)} onCancel={() => navigation.dismissDomain(nameRequest.origin)}
      onClosed={() => {setNameRequest((current) => current?.key === nameRequest.key ? null : current); navigation.panelClosed('domain-dialog');}}/>}
    {closeRequest && <CloseShiftDialog shiftName={state.snapshot?.shifts.find((shift) => shift.id === closeRequest.shiftId)?.label ?? 'Turno'} open={state.overlays.layers.some((layer) => layer.id === 'domain-dialog')} pending={state.snapshot?.tasks.filter((task) => task.shiftId === closeRequest.shiftId && !task.completed).length ?? 0} beforeClose={state.snapshot?.tasks.filter((task) => task.shiftId === closeRequest.shiftId && !task.completed && task.beforeClose).length ?? 0} busy={state.busy} error={closeError}
      onConfirm={() => {void submitClose(closeRequest);}} onCancel={() => navigation.dismissDomain(closeRequest.origin)}
      onClosed={() => {setCloseRequest((current) => current?.key === closeRequest.key ? null : current); navigation.panelClosed('domain-dialog');}}/>}
    <AssistanceDialog store={session.store} notifications={session.notifications}
      open={state.overlays.layers.some((layer) => layer.id === 'assistance')} tab={assistanceTab}
      returnFocusKey={state.overlays.layers.find((layer) => layer.id === 'assistance')?.returnFocusKey ?? null}
      suggestions={visibleSuggestions} onTabChange={setAssistanceTab}
      onDismissSuggestion={(id) => setDismissedSuggestions((current) => current.includes(id) ? current : [...current, id])}
      onClose={() => overlays.close('assistance')}
      onSelectTask={(id) => {overlays.close('assistance'); navigation.select({kind: 'task', id});}}/>
    <DemoDialog port={session.port}/>
    <UnsavedChangesDialog open={state.overlays.layers.some((layer) => layer.id === 'unsaved-changes')} busy={state.busy} onCancel={navigation.cancel} onDiscard={navigation.discard} onSave={() => {void navigation.save();}} onClosed={navigation.dialogClosed}/>
  </>;
}
