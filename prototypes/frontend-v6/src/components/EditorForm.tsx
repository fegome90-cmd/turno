import {useLayoutEffect, useRef} from 'react';
import {useStore} from 'zustand';
import {Field} from '@base-ui/react/field';
import {Form} from '@base-ui/react/form';
import {Plus} from 'lucide-react';
import type {TurnoStore} from '../app/store';
import type {Selection} from '../domain/types';
import '../styles/editor.css';

function fitTitle(node: HTMLTextAreaElement) {
  const style = getComputedStyle(node);
  const border = style.boxSizing === 'border-box' ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0) : 0;
  node.style.height = 'auto';
  if (node.scrollHeight) node.style.height = `${node.scrollHeight + border}px`;
}

export type FieldFocusRequest = {revision: number; selection: Selection; origin: Element | null};
export type EditorProps = {store: TurnoStore; beforeEdit?: () => void; focusFirstInvalid?: (request: FieldFocusRequest) => void; onCreateTask?: () => void};

export function EditorForm({store, note, beforeEdit, focusFirstInvalid, onCreateTask}: EditorProps & {note: boolean}) {
  const state = useStore(store);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  const composing = useRef(false);
  const draft = state.draft;
  useLayoutEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useLayoutEffect(() => {
    const node = titleRef.current;
    if (node) fitTitle(node);
  }, [draft?.title]);
  useLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    let active = true, frame = 0, width = -1;
    const schedule = () => {
      if (!active) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {frame = 0; if (active && titleRef.current === node) fitTitle(node);});
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next === undefined || next === width) return;
      width = next; schedule();
    }) : null;
    observer?.observe(node);
    if (!observer) window.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {active = false; observer?.disconnect(); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame);};
  }, [draft?.id, draft?.kind]);
  if (!draft || (draft.kind === 'note') !== note) return null;
  const task = draft.kind === 'task' ? state.snapshot?.tasks.find((item) => item.id === draft.id) : undefined;
  const readOnly = !!task && state.snapshot?.shifts.find((shift) => shift.id === task.shiftId)?.status !== 'open';
  const locked = state.busy || readOnly;
  const edit = (field: 'title'|'body', value: string) => {
    if (locked || store.getState().busy) return;
    beforeEdit?.(); state.setDraftField(field, value);
  };
  const focusInvalid = (request: FieldFocusRequest) => {
    const current = store.getState();
    if (current.draftRevision !== request.revision || current.selection?.kind !== request.selection?.kind || current.selection?.id !== request.selection?.id) return;
    if (focusFirstInvalid) {focusFirstInvalid(request); return;}
    const key = Object.keys(store.getState().errors)[0];
    if (key) document.getElementById(key)?.focus();
  };
  const restoreActionFocus = (request: FieldFocusRequest) => {
    const current = store.getState();
    if (!alive.current || request.revision !== current.draftRevision || request.selection?.kind !== current.selection?.kind || request.selection?.id !== current.selection?.id) return;
    if (!request.origin?.isConnected || !request.origin.matches('.save-actions button')) return;
    if (current.overlays.layers.some((layer) => layer.kind !== 'more')) return;
    const active = document.activeElement;
    if (active !== document.body && active !== request.origin) return;
    bodyRef.current?.focus();
  };
  const save = async () => {
    if (locked || !store.getState().dirty) return;
    const request: FieldFocusRequest = {revision: store.getState().draftRevision, selection: store.getState().selection, origin: document.activeElement};
    const result = note ? await store.getState().saveNote() : await store.getState().saveTask();
    if (result.status === 'invalid') queueMicrotask(() => focusInvalid(request));
    else if (result.status === 'saved' && result.appliedToDraft && result.revision === request.revision) queueMicrotask(() => restoreActionFocus(request));
  };
  const cancel = () => {
    if (locked || store.getState().busy) return;
    const origin = document.activeElement;
    beforeEdit?.(); state.cancelDraft();
    const current = store.getState();
    const request = {origin, revision: current.draftRevision, selection: current.selection};
    queueMicrotask(() => restoreActionFocus(request));
  };
  const setTask = (field: 'reason'|'priority'|'completed', value: string|boolean) => {
    if (locked || store.getState().busy) return;
    beforeEdit?.(); state.setTaskField(field, value);
  };
  const titleLabel = `Título de ${note ? 'nota' : 'tarea'}`;
  const titleEmpty = !draft.title.trim();
  const generalSaveError = Object.values(state.errors).includes(state.saveError) ? '' : state.saveError;
  return <main id="main" tabIndex={-1} data-editor-layout="editorial" className={`editor ${note ? 'note-editor' : ''}`}>
    <Form id="editor-form" aria-describedby="save-feedback save-error" onSubmit={(event) => {event.preventDefault(); void save();}}>
      {readOnly && <p className="archive-notice">Turno archivado · Solo lectura. Los pendientes se conservan.</p>}
      <div className={`title-line ${titleEmpty ? 'title-empty' : ''}`}>
        {draft.kind === 'task' && <label className="check-target"><input id="editor-completed" type="checkbox" aria-label="Tarea completada" checked={draft.completed} disabled={locked} onChange={(event) => setTask('completed', event.currentTarget.checked)}/></label>}
        <Field.Root name="title" invalid={!!state.errors.title} className="title-field">
          <Field.Label htmlFor="title" className={`editor-title-label ${titleEmpty ? '' : 'visually-hidden'}`}>{titleLabel}</Field.Label>
          <h1><textarea ref={titleRef} id="title" name="title" data-focus-key="field-title" rows={1} maxLength={300} required placeholder="Escribe un título…" value={draft.title} readOnly={locked}
            aria-invalid={state.errors.title ? true : undefined} aria-describedby={state.errors.title ? 'field-error-title' : undefined}
            onCompositionStart={() => {composing.current = true;}}
            onCompositionEnd={(event) => {composing.current = false; const value = event.currentTarget.value.replace(/\r?\n/g, ' '); if (value !== event.currentTarget.value) edit('title', value);}}
            onChange={(event) => edit('title', composing.current || (event.nativeEvent as InputEvent).isComposing ? event.currentTarget.value : event.currentTarget.value.replace(/\r?\n/g, ' '))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
              event.preventDefault();
              if (!locked && store.getState().dirty) event.currentTarget.form?.requestSubmit();
            }}/></h1>
          {state.errors.title && <Field.Error match={true} id="field-error-title" className="field-error error">{state.errors.title}</Field.Error>}
        </Field.Root>
        {!note && !readOnly && <button type="button" className="add-inline" aria-label="Agregar tarea" data-focus-key="create-task-inline" disabled={locked || !onCreateTask} onClick={onCreateTask}><Plus aria-hidden="true" size={20}/></button>}
      </div>
      {draft.kind === 'task' ? <div className="metadata">
        <span className="metadata-context">{state.snapshot?.beds.find((bed) => bed.id === task?.bedId)?.label ?? 'Sin lista'}</span>
        <label className="metadata-field" htmlFor="reason"><span>Motivo</span><input id="reason" name="reason" data-focus-key="field-reason" value={draft.reason} placeholder="Ej.: Exámenes" maxLength={80} readOnly={locked} onChange={(event) => setTask('reason', event.currentTarget.value)}/></label>
        <label className="metadata-field priority-field" htmlFor="priority"><span>Prioridad</span><select id="priority" name="priority" data-focus-key="field-priority" value={draft.priority} disabled={locked} onChange={(event) => setTask('priority', event.currentTarget.value)}><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baja</option></select></label>
      </div> : <p className="note-caption">Una nota independiente de tus turnos y listas.</p>}
      <Field.Root name="body" invalid={!!state.errors.body} className="body-field">
        <Field.Label className="notes-heading" htmlFor="body">{note ? 'Texto de la nota' : 'Notas de la tarea'}</Field.Label>
        <textarea ref={bodyRef} id="body" name="body" data-focus-key="field-body" value={draft.body} placeholder="Escribe aquí…" maxLength={10000} readOnly={locked}
          aria-invalid={state.errors.body ? true : undefined} aria-describedby={state.errors.body ? 'field-error-body' : undefined}
          onChange={(event) => edit('body', event.currentTarget.value)}/>
        {state.errors.body && <Field.Error match={true} id="field-error-body" className="field-error error">{state.errors.body}</Field.Error>}
      </Field.Root>
      <div className="save-footer"><div><p id="save-error" className="error">{generalSaveError}</p><p id="save-feedback" className="save-feedback">{state.feedback || (state.dirty ? 'Cambios sin guardar' : readOnly ? 'Solo lectura' : 'Guardado en memoria de demostración')}</p></div>
        {!readOnly && <div className="save-actions"><button type="button" disabled={!state.dirty || state.busy} onClick={cancel}>Cancelar</button><button type="submit" className="primary" disabled={!state.dirty || state.busy}>{state.busy ? 'Guardando…' : 'Guardar'}</button></div>}
      </div>
    </Form>
  </main>;
}
