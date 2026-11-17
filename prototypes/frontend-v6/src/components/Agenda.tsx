import {useStore} from 'zustand';
import {CalendarDays, CircleCheck} from 'lucide-react';
import type {TurnoStore} from '../app/store';
import {displayDate, groupAgenda, ZONE} from '../domain/format';

export function Agenda({store, onSelect, onCreateTask}: {store: TurnoStore; onSelect(id: string): void; onCreateTask?(): void}) {
  const state = useStore(store);
  const shift = state.snapshot?.shifts.find((item) => item.id === (state.archiveId || state.snapshot?.activeShiftId));
  const tasks = state.snapshot?.tasks.filter((task) => task.shiftId === shift?.id) ?? [];
  const pending = tasks.filter((task) => !task.completed).length;
  const groups = groupAgenda(tasks);
  const listLabel = (id: string | null) => state.snapshot?.beds.find((bed) => bed.id === id)?.label ?? 'Sin lista';
  return <div className="agenda">
    <div className="agenda-overview"><p className="agenda-caption">{shift?.label ?? 'Sin turno activo'}</p><p className="agenda-count">{tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'} · {pending} {pending === 1 ? 'pendiente' : 'pendientes'}</p></div>
    {groups.map((group, index) => <section className="agenda-group" key={group.date ?? 'undated'} aria-labelledby={`agenda-group-${index}`}>
      <div className="agenda-group-heading"><h3 id={`agenda-group-${index}`}>{group.label}</h3>{group.date && (group.label === 'Hoy' || group.label === 'Mañana') && <span>{displayDate(group.date)}</span>}</div>
      <div className="agenda-items">{group.tasks.map((task) => <button key={task.id} type="button" className={`agenda-task ${task.completed ? 'is-completed' : ''} ${state.selection?.kind === 'task' && state.selection.id === task.id ? 'current' : ''}`}
        aria-current={state.selection?.kind === 'task' && state.selection.id === task.id ? 'true' : undefined}
        aria-label={`${task.time || 'Sin hora'} · ${task.title}${task.priority === 'high' ? ' · Prioridad Alta' : ''} · ${listLabel(task.bedId)}${task.completed ? ' · Completada' : ''}`}
        onClick={() => onSelect(task.id)}>
        <span className="agenda-time">{task.time || (task.beforeClose ? 'Cierre' : 'Sin hora')}</span><span className="agenda-detail"><span className="agenda-title">{task.title}</span>
          {task.priority === 'high' && <span className="priority-badge"><svg className="priority-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><span className="visually-hidden">Prioridad </span>Alta</span>}
          <small>{listLabel(task.bedId)}{task.beforeClose ? ' · Antes del cierre' : ''}{task.completed ? ' · Completada' : ''}</small>
        </span>{task.completed && <CircleCheck aria-hidden="true" size={15}/>}
      </button>)}</div>
    </section>)}
    {groups.length === 0 && <div className="agenda-empty"><CalendarDays aria-hidden="true" size={24}/><p>No hay tareas en este turno.</p><span>{shift?.status === 'open' && !state.archiveId ? 'Agrega una tarea. Aparecerá aquí aunque no tenga fecha.' : 'Las tareas con y sin fecha aparecerán aquí.'}</span>{shift?.status === 'open' && !state.archiveId && <button type="button" data-focus-key="create-task-agenda" disabled={state.busy || !!state.archiveId || !onCreateTask} onClick={onCreateTask}>Agregar tarea</button>}</div>}
    <p className="agenda-zone">{ZONE}<br/>Lista del turno · Sin avisos programados</p>
  </div>;
}
