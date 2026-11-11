import {useEffect, useRef, useState} from 'react';
import {useStore} from 'zustand';
import {Archive, ChevronDown, Home as HomeIcon, NotebookPen, Plus, Play, Pencil, Search, FilePenLine} from 'lucide-react';
import type {TurnoStore} from '../app/store';
import {displayDate} from '../domain/format';
import type {Selection, Task} from '../domain/types';
import {useTheme} from '../appearance/theme-provider';
import flower from '../assets/brand/flor-negro-512.png?url';
import {MoreOptions} from './MoreOptions';
import {useOverlays} from './OverlayCoordinator';

export type NavigationActions = {home(): void; openShift(origin?: string): void; notes(): void; select(selection: NonNullable<Selection>): void; requestCompletion(id: string, completed: boolean): void; createTask?(bedId?: string | null, origin?: string): void; createBed?(): void; renameBed?(id: string): void; createNote?(): void; archive?(): void};

export function Navigation({store, actions}: {store: TurnoStore; actions?: NavigationActions}) {
  const state = useStore(store);
  const theme = useTheme();
  const overlays = useOverlays();
  const scroll = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const refreshCue = () => {const node = scroll.current; setHasMore(!!node && node.scrollHeight > node.clientHeight && node.scrollTop + node.clientHeight < node.scrollHeight - 1);};
  useEffect(() => {
    refreshCue();
    const node = scroll.current;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshCue) : null;
    if (node) {observer?.observe(node); if (node.firstElementChild) observer?.observe(node.firstElementChild);}
    window.addEventListener('resize', refreshCue);
    return () => {observer?.disconnect(); window.removeEventListener('resize', refreshCue);};
  }, [state.snapshot, state.expandedBeds, state.filter, state.view, state.query]);
  const navigate = (view: typeof state.view) => {
    if (actions) {if (view === 'home') actions.home(); else if (view === 'notes') actions.notes(); else if (view === 'workspace') actions.openShift('open-shift-nav'); return;}
    state.setView(view); overlays.close('navigation');
  };
  const select = (selection: NonNullable<Selection>) => {
    if (actions) {actions.select(selection); return;}
    state.select(selection); state.setView(selection.kind === 'task' ? 'workspace' : 'notes'); overlays.close('navigation');
  };
  const activeShift = state.snapshot?.shifts.find((shift) => shift.id === state.snapshot?.activeShiftId);
  const shownShift = state.snapshot?.shifts.find((shift) => shift.id === (state.archiveId || state.snapshot?.activeShiftId));
  const tasks = state.snapshot?.tasks.filter((task) => task.shiftId === shownShift?.id) ?? [];
  const visibleTasks = tasks.filter((task) => (state.filter === 'all' || !task.completed) && `${task.title} ${task.body} ${task.reason}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  const row = (task: Task) => <div className={`task-row ${state.selection?.id === task.id ? 'current' : ''}`} key={task.id}>
    <label className="check-target"><input type="checkbox" data-focus-key={`complete-${task.id}`} aria-label={`${task.completed ? 'Reabrir' : 'Completar'} ${task.title}`} checked={task.completed} disabled={state.busy || shownShift?.status !== 'open'} onChange={(event) => {if (actions) actions.requestCompletion(task.id, event.target.checked); else void state.setCompleted(task.id, event.target.checked);}}/></label>
    <button className={`task-button ${task.completed ? 'completed' : ''}`} data-focus-key={`select-${task.id}`} aria-label={task.priority === 'high' ? `${task.title} · Prioridad Alta` : undefined} aria-current={state.selection?.id === task.id ? 'true' : undefined} onClick={() => select({kind: 'task', id: task.id})}><span className="task-title">{task.title}</span>{task.priority === 'high' && <span className="priority-badge"><svg className="priority-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><span className="visually-hidden">Prioridad </span>Alta</span>}</button>
  </div>;
  return <nav className="navigation" aria-label="Principal">
    <div className="brand"><button className="brand-button" data-focus-key="brand" aria-label="Turno · Inicio" onClick={() => navigate('home')}><span>Inicio</span></button><img className="brand-flower" src={flower} alt=""/></div>
    <div className="nav-scroll-wrapper"><div ref={scroll} className={`nav-scroll ${hasMore ? 'has-more' : ''}`} onScroll={refreshCue} data-testid="nav-scroll"><div>
      <div className="nav-actions">
        <button className={`nav-item ${state.view === 'home' ? 'selected' : ''}`} aria-current={state.view === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><HomeIcon aria-hidden="true" size={20}/>Inicio</button>
        <button data-focus-key="open-shift-nav" className={`nav-item shift-button ${state.view === 'workspace' && !state.archiveId ? 'selected' : ''}`} onClick={() => navigate('workspace')} disabled={!activeShift && !actions?.openShift}><Play aria-hidden="true" size={20}/><span>{activeShift ? 'Ir al turno actual' : 'Iniciar turno'}</span></button>
        <button className="nav-item" data-focus-key="create-task-global" disabled={state.busy || !activeShift || !actions?.createTask} onClick={() => actions?.createTask?.()}><Plus aria-hidden="true" size={16}/><span>Agregar tarea</span></button>
      </div>
      {state.view !== 'home' && shownShift && <>
        <div className="shift-context"><strong>{shownShift.label}</strong><span>{displayDate(shownShift.date)} · {shownShift.status === 'closed' ? 'Archivado' : 'Abierto'}</span></div>
        <label className="search-label"><Search aria-hidden="true" size={20}/><input type="search" placeholder="Buscar en este turno" aria-label="Buscar tareas" value={state.query} onChange={(event) => state.setQuery(event.target.value)}/></label>
        <div className="nav-filters" role="group" aria-label="Filtrar tareas">{([['all', 'Todas'], ['pending', 'Pendientes']] as const).map(([value,label]) => <button key={value} className={state.filter === value ? 'active' : ''} aria-pressed={state.filter === value} onClick={() => state.setFilter(value)}>{label}</button>)}</div>
        <div className="section-heading bed-heading"><span>Listas</span>{!state.archiveId && <button data-focus-key="create-bed" disabled={state.busy || !!state.archiveId || !actions?.createBed} onClick={() => actions?.createBed?.()} aria-label="Agregar lista" className="icon-button"><Plus aria-hidden="true" size={20}/></button>}</div>
        <div className="task-tree">{state.snapshot?.beds.filter((bed) => bed.shiftId === shownShift.id).map((bed) => <section className="bed-group" key={bed.id}>
          <div className="bed-line"><button className="bed-button" aria-expanded={state.expandedBeds.includes(bed.id) || !!state.query} aria-controls={`group-${bed.id}`} onClick={() => state.toggleBed(bed.id)}><ChevronDown aria-hidden="true" size={20}/><span>{bed.label}</span></button>{!state.archiveId && <button data-focus-key={`rename-${bed.id}`} disabled={state.busy || !actions?.renameBed} onClick={() => actions?.renameBed?.(bed.id)} className="icon-button subtle" aria-label={`Editar nombre de ${bed.label}`}><Pencil aria-hidden="true" size={20}/></button>}{!state.archiveId && <button data-focus-key={`create-task-bed-${bed.id}`} disabled={state.busy || !!state.archiveId || !actions?.createTask} onClick={() => actions?.createTask?.(bed.id, `create-task-bed-${bed.id}`)} className="icon-button subtle" aria-label={`Agregar tarea a ${bed.label}`}><Plus aria-hidden="true" size={20}/></button>}</div>
          <div id={`group-${bed.id}`} hidden={!state.expandedBeds.includes(bed.id) && !state.query}>{visibleTasks.filter((task) => task.bedId === bed.id).map(row)}</div>
        </section>)}{visibleTasks.filter((task) => !task.bedId).map(row)}
        {visibleTasks.length === 0 && <><p className="nav-hint">{state.query ? `Sin coincidencias para «${state.query}».` : state.filter === 'pending' ? 'No hay tareas pendientes.' : 'Este turno todavía no tiene tareas.'}</p>{(state.query || state.filter === 'pending') && <button className="nav-item" onClick={() => {state.setQuery(''); state.setFilter('all');}}>Limpiar filtros</button>}</>}
        </div>
      </>}
      <div className="section-heading"><button className="section-title" onClick={() => navigate('notes')}><NotebookPen aria-hidden="true" size={20}/>Notas rápidas</button><button data-focus-key="create-note" disabled={state.busy || !actions?.createNote} onClick={() => actions?.createNote?.()} aria-label="Agregar nota rápida" className="icon-button"><Plus aria-hidden="true" size={20}/></button></div>
      {state.view === 'notes' && state.snapshot?.notes.map((note) => <button className="tree-task" key={note.id} data-focus-key={`select-${note.id}`} onClick={() => select({kind: 'note', id: note.id})}><FilePenLine aria-hidden="true" size={20}/><span>{note.title}</span></button>)}
    </div></div></div>
    <footer ref={footer} className="nav-footer"><div className="footer-actions"><button className="footer-action" data-focus-key="open-archive" aria-label="Archivo de turnos anteriores" disabled={state.busy || !actions?.archive} onClick={() => actions?.archive?.()} title="Turnos anteriores"><Archive aria-hidden="true" size={20}/><span>Archivo</span></button>
      <MoreOptions anchor={footer} theme={theme.preference} onThemeChange={theme.setPreference} onDemo={() => {
        const fromDrawer = overlays.state.layers.some((layer) => layer.id === 'navigation');
        if (fromDrawer) overlays.close('navigation');
        overlays.open({id: 'demo', kind: 'demo', returnFocusKey: fromDrawer ? 'open-nav' : 'more-trigger'});
      }}/>
    </div></footer>
  </nav>;
}
