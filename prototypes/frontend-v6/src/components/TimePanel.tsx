import {useEffect, useLayoutEffect, useRef, type ReactNode} from 'react';
import {useStore} from 'zustand';
import {Tabs} from '@base-ui/react/tabs';
import {Field} from '@base-ui/react/field';
import {Collapsible} from '@base-ui/react/collapsible';
import {CalendarDays, Clock, Timer, Bell, CircleCheck, RotateCcwClock, ChevronDown, X} from 'lucide-react';
import type {TurnoStore} from '../app/store';
import {displayDate, ZONE} from '../domain/format';
import {TemporalField} from './TemporalField';
import {isLayerOpen, useOverlays} from './OverlayCoordinator';
import '../styles/time-panel.css';

function Property({id, label, icon, value, open, onToggle, children}: {id: string; label: string; icon: ReactNode; value: string; open: boolean; onToggle(expanded: boolean): void; children: ReactNode}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open && panel.current?.contains(document.activeElement)) trigger.current?.focus();
  }, [open]);
  return <Collapsible.Root className="property" open={open} onOpenChange={onToggle}>
    <Collapsible.Trigger ref={trigger} className="property-trigger" aria-label={`${label}${value ? ` · ${value}` : ''}`} data-focus-key={`property-${id}`}>{icon}<span>{label}</span><span className="property-value">{value}</span><ChevronDown className="disclosure-chevron" aria-hidden="true" size={15}/></Collapsible.Trigger>
    <Collapsible.Panel ref={panel} id={`property-content-${id}`} className="property-content" keepMounted inert={!open} hidden={!open}>{children}</Collapsible.Panel>
  </Collapsible.Root>;
}

export function TimePanel({store, beforeEdit, agenda}: {store: TurnoStore; beforeEdit?: () => void; agenda?: ReactNode}) {
  const state = useStore(store);
  const overlays = useOverlays();
  const drawerOpen = isLayerOpen(overlays.state, 'time');
  const previousOpen = useRef(drawerOpen);
  useEffect(() => {
    if (drawerOpen && !previousOpen.current && (state.view === 'home' || !state.draft)) state.setTimeTab('agenda');
    previousOpen.current = drawerOpen;
  }, [drawerOpen, state]);
  const task = state.selection?.kind === 'task' ? state.snapshot?.tasks.find((item) => item.id === state.selection?.id) : undefined;
  const disabled = state.busy || (!!task && state.snapshot?.shifts.find((shift) => shift.id === task.shiftId)?.status !== 'open');
  const edit = (field: keyof typeof state.temporal, value: string) => {
    if (disabled || store.getState().busy) return;
    beforeEdit?.(); state.setTemporalField(field, value);
  };
  const property = (id: string, label: string, icon: ReactNode, value: string, children: ReactNode) => <Property key={id} id={id} label={label} icon={icon} value={value} open={state.expandedProperties.includes(id)} onToggle={(open) => state.setPropertyExpanded(id, open)}>{children}</Property>;
  const temporal = (id: 'time'|'estimate'|'performed'|'duration', label: string, kind: 'time'|'minutes', hint?: ReactNode) => <TemporalField id={id} label={label} kind={kind} value={state.temporal[id]} onValueChange={(value) => edit(id, value)} error={state.errors[id] ?? null} disabled={disabled} placeholder={kind === 'time' ? 'HH:mm' : '0'} hint={hint}/>;
  let content: ReactNode;
  if (state.view === 'home' || !state.draft) content = <div className="note-inspector"><p>Selecciona una tarea</p><p className="muted">Abre una tarea del turno para ver sus fechas y tiempos. En Agenda puedes consultar la lista completa.</p></div>;
  else if (state.draft.kind === 'note') content = <div className="note-inspector"><p>Nota rápida</p><p className="muted">Esta nota no pertenece a un turno ni tiene fechas de tarea.</p></div>;
  else content = <>
    {property('date', 'Fecha', <CalendarDays aria-hidden="true" size={20}/>, displayDate(task?.date ?? null), <>
      <Field.Root invalid={!!state.errors.date} className="temporal-field"><Field.Label htmlFor="date">Día / mes / año</Field.Label><Field.Control id="date" name="date" type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA" value={state.temporal.date} disabled={disabled} data-focus-key="field-date" onChange={(event) => edit('date', event.currentTarget.value)}/>{state.errors.date && <Field.Error match={true} id="field-error-date" className="field-error error">{state.errors.date}</Field.Error>}</Field.Root>
      <p>Una fecha sin hora no programa un aviso.</p>
    </>)}
    {property('time', 'Hora prevista', <Clock aria-hidden="true" size={20}/>, task?.time || 'Añadir', temporal('time', 'Hora local · 24 h', 'time', ZONE))}
    {property('estimate', 'Estimación', <Timer aria-hidden="true" size={20}/>, task?.estimate !== '' ? `${task?.estimate ?? ''} min` : 'Añadir', temporal('estimate', 'Minutos estimados', 'minutes'))}
    {property('reminder', 'Recordatorio', <Bell aria-hidden="true" size={20}/>, 'Sin programar', <p>Los avisos se solicitan explícitamente en ChatGPT. Esta demostración no envía ni programa recordatorios.</p>)}
    {property('performed', 'Realización', <CircleCheck aria-hidden="true" size={20}/>, task?.performed || 'Sin registrar', temporal('performed', 'Hora realizada · 24 h', 'time', 'Entrada manual. Marcar hecha no rellena esta hora.'))}
    {property('duration', 'Duración registrada', <Timer aria-hidden="true" size={20}/>, task?.duration !== '' ? `${task?.duration ?? ''} min` : 'Sin registrar', temporal('duration', 'Total manual de prueba · minutos', 'minutes', 'Control visual provisional. El modelo de intervalos se definirá al integrar.'))}
    {property('activity', 'Actividad', <RotateCcwClock aria-hidden="true" size={20}/>, '', <p>Versión local {task?.version}. No hay historial remoto conectado.</p>)}
  </>;
  return <section className="time-content">
    <div className="inspector-heading"><div><h2>Tiempo</h2><p className="inspector-subtitle">Fechas y contexto del turno</p></div><button type="button" className="icon-button" aria-label="Cerrar Tiempo" onClick={() => {if (drawerOpen) overlays.close('time'); else state.setInspectorHidden(true);}}><X aria-hidden="true" size={20}/></button></div>
    <Tabs.Root value={state.timeTab} onValueChange={(value) => {if (value === 'task' || value === 'agenda') state.setTimeTab(value);}}>
      <Tabs.List activateOnFocus loopFocus className="inspector-tabs" aria-label="Vista temporal">
        <Tabs.Tab value="task" id="tab-task" aria-controls="time-panel-task">Tarea</Tabs.Tab><Tabs.Tab value="agenda" id="tab-agenda" aria-controls="time-panel-agenda">Agenda</Tabs.Tab>
        <Tabs.Indicator className="tab-indicator" aria-hidden="true"/>
      </Tabs.List>
      <Tabs.Panel value="task" id="time-panel-task" aria-labelledby="tab-task" keepMounted inert={state.timeTab !== 'task'}>{content}</Tabs.Panel>
      <Tabs.Panel value="agenda" id="time-panel-agenda" aria-labelledby="tab-agenda" keepMounted inert={state.timeTab !== 'agenda'}>{agenda ?? <p className="slot-boundary">Agenda · integración pendiente</p>}</Tabs.Panel>
    </Tabs.Root>
  </section>;
}
