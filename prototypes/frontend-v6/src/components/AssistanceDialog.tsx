import {useRef, useState, type KeyboardEvent} from 'react';
import {useStore} from 'zustand';
import {Dialog} from '@base-ui/react/dialog';
import {Check, Lightbulb, Plus, X} from 'lucide-react';
import type {TurnoStore} from '../app/store';
import type {NotificationStore} from '../notifications/notification-store';
import {newReviewDraft, reviewInput, type AmbientSuggestion, type ReviewDraft} from '../ambient/review';
import {resolveReturnFocus} from './OverlayCoordinator';
import '../styles/assistance.css';

export type AssistanceTab = 'capture' | 'suggestions';

export function AssistanceDialog({
  store, notifications, open, tab, returnFocusKey, suggestions, onTabChange, onDismissSuggestion, onClose, onSelectTask,
}: {
  store: TurnoStore;
  notifications: NotificationStore;
  open: boolean;
  tab: AssistanceTab;
  returnFocusKey: string | null;
  suggestions: AmbientSuggestion[];
  onTabChange(tab: AssistanceTab): void;
  onDismissSuggestion(id: string): void;
  onClose(): void;
  onSelectTask(id: string): void;
}) {
  const snapshot = useStore(store, (state) => state.snapshot);
  const globallyBusy = useStore(store, (state) => state.busy);
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const serial = useRef(0);
  const inFlight = useRef(false);
  const active = snapshot?.shifts.find((shift) => shift.id === snapshot.activeShiftId && shift.status === 'open');
  const beds = snapshot?.beds.filter((bed) => bed.shiftId === active?.id) ?? [];
  const hasUnreviewed = input.trim().length > 0 || drafts.length > 0;

  const close = () => {
    if (inFlight.current || globallyBusy) return;
    if (hasUnreviewed) {setDiscardConfirm(true); return;}
    setDiscardConfirm(false);
    onClose();
  };
  const discardAndClose = () => {
    if (inFlight.current || globallyBusy) return;
    setInput(''); setDrafts([]); setErrors({}); setFormError(''); setDiscardConfirm(false); onClose();
  };
  const add = (lines: string[]) => {
    const titles = lines.map((value) => value.trim()).filter(Boolean);
    if (!titles.length) {setFormError('Escribe al menos una tarea.'); return;}
    if (drafts.length + titles.length > 10) {setFormError('Puedes revisar hasta 10 tareas a la vez.'); return;}
    setDrafts((current) => [...current, ...titles.map((title) => newReviewDraft('review-' + ++serial.current, title))]);
    setFormError(''); setInput('');
  };
  const addBlank = () => {
    if (drafts.length >= 10) return;
    setDrafts((current) => [...current, newReviewDraft('review-' + ++serial.current)]);
    setFormError('');
  };
  const update = (id: string, patch: Partial<ReviewDraft>) => {
    setDrafts((current) => current.map((draft) => draft.localId === id ? {...draft, ...patch} : draft));
    setErrors((current) => {const next = {...current}; delete next[id]; return next;});
  };
  const save = async (draft: ReviewDraft) => {
    if (globallyBusy || inFlight.current) return;
    const review = reviewInput(draft, store.getState().snapshot);
    if (!review.value) {
      setErrors((current) => ({...current, [draft.localId]: review.error || 'Revisión incompleta.'}));
      return;
    }
    inFlight.current = true;
    setPendingSave(draft.localId);
    try {
      const result = await store.getState().createReviewedTask(review.value);
      if (result.status === 'saved') {
        setDrafts((current) => current.filter((item) => item.localId !== draft.localId));
        setErrors((current) => {const next = {...current}; delete next[draft.localId]; return next;});
        notifications.notify('Tarea guardada en el turno de demostración.', 'status');
      } else {
        setErrors((current) => ({
          ...current, [draft.localId]:
            result.status === 'error' || result.status === 'invalid' ? result.message
            : 'No se pudo guardar. Revisa el turno e inténtalo nuevamente.',
        }));
      }
    } finally {
      inFlight.current = false;
      setPendingSave(null);
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'End' ? 'suggestions'
      : event.key === 'ArrowLeft' || event.key === 'Home' ? 'capture' : null;
    if (!next) return;
    event.preventDefault();
    onTabChange(next);
    requestAnimationFrame(() => document.getElementById(next === 'capture' ? 'assist-capture-tab' : 'assist-suggestions-tab')?.focus());
  };

  return <Dialog.Root open={open} onOpenChange={(next, details) => {
    if (!next) {if (inFlight.current || globallyBusy) details.cancel(); else close();}
  }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="overlay-backdrop"/>
      <Dialog.Popup className="assist-dialog" finalFocus={() => resolveReturnFocus(returnFocusKey) || false} initialFocus={false}>
        <div className="assist-heading">
          <div><Dialog.Title>Captura y sugerencias</Dialog.Title><Dialog.Description>Revisión de tareas de Turno. No hay un modelo de IA conectado.</Dialog.Description></div>
          <button type="button" className="icon-button" aria-label="Cerrar captura y sugerencias" disabled={!!pendingSave} onClick={close}><X size={20} aria-hidden="true"/></button>
        </div>
        <div className="assist-tabs" role="tablist" aria-label="Asistencia de Turno">
          <button role="tab" id="assist-capture-tab" onKeyDown={onTabKeyDown} aria-selected={tab === 'capture'} aria-controls="assist-capture-panel" tabIndex={tab === 'capture' ? 0 : -1} onClick={() => onTabChange('capture')}>Captura</button>
          <button role="tab" id="assist-suggestions-tab" onKeyDown={onTabKeyDown} aria-selected={tab === 'suggestions'} aria-controls="assist-suggestions-panel" tabIndex={tab === 'suggestions' ? 0 : -1} onClick={() => onTabChange('suggestions')}>Sugerencias ({suggestions.length})</button>
        </div>
        <section id="assist-capture-panel" role="tabpanel" aria-labelledby="assist-capture-tab" hidden={tab !== 'capture'}>
          <div className="assist-info"><strong>Captura manual disponible</strong><p>Escribe una tarea literal por línea. No interpretaremos horarios, camas ni instrucciones: completarás esos campos durante la revisión. La interpretación con Strands se conectará después.</p></div>
          <label className="assist-field" htmlFor="assist-input">Tareas para revisar
            <textarea id="assist-input" rows={3} maxLength={2500} value={input} disabled={!active || !!pendingSave}
              placeholder="Una tarea por línea" onChange={(event) => {setInput(event.target.value); setFormError('');}}/>
          </label>
          <div className="assist-inline-actions">
            <button type="button" className="assist-secondary" disabled={!active || !input.trim() || !!pendingSave}
              onClick={() => add(input.split(/\r?\n/))}>Pasar a revisión</button>
            <button type="button" className="assist-secondary" disabled={!active || drafts.length >= 10 || !!pendingSave} onClick={addBlank}>
              <Plus size={16} aria-hidden="true"/> Nueva tarjeta
            </button>
          </div>
          {!active && <p className="assist-info">Abre un turno para crear tareas.</p>}
          {formError && <p role="alert" className="assist-error">{formError}</p>}
          <div className="assist-review-list" aria-label="Tareas pendientes de revisión">
            {drafts.length === 0 && <p className="assist-empty">Todavía no hay tareas en revisión.</p>}
            {drafts.map((draft, index) => <fieldset className="assist-review-card" key={draft.localId}>
              <legend>Tarea {index + 1} · Pendiente de aprobación</legend>
              <label className="assist-field">Título
                <input type="text" maxLength={300} value={draft.title} disabled={!!pendingSave}
                  onChange={(event) => update(draft.localId, {title: event.target.value})}/>
              </label>
              <div className="assist-fields-row">
                <label className="assist-field">Lista
                  <select value={draft.bedId} disabled={!!pendingSave} onChange={(event) => update(draft.localId, {bedId: event.target.value})}>
                    <option value="">Sin lista</option>
                    {beds.map((bed) => <option value={bed.id} key={bed.id}>{bed.label}</option>)}
                  </select>
                </label>
                <label className="assist-field">Fecha
                  <input type="date" value={draft.date} disabled={!!pendingSave}
                    onChange={(event) => update(draft.localId, {date: event.target.value})}/>
                </label>
                <label className="assist-field">Hora
                  <input type="time" value={draft.time} disabled={!!pendingSave}
                    onChange={(event) => update(draft.localId, {time: event.target.value})}/>
                </label>
              </div>
              <label className="assist-condition"><input type="checkbox" checked={draft.beforeClose} disabled={!!pendingSave}
                onChange={(event) => update(draft.localId, {beforeClose: event.target.checked})}/> Antes del cierre (sin fecha ni hora)</label>
              {errors[draft.localId] && <p role="alert" className="assist-error">{errors[draft.localId]}</p>}
              <div className="assist-card-actions">
                <button type="button" className="assist-secondary" disabled={!!pendingSave} onClick={() => {
                  setDrafts((items) => items.filter((item) => item.localId !== draft.localId));
                }}>Descartar</button>
                <button type="button" className="assist-primary" disabled={!!pendingSave || globallyBusy}
                  onClick={() => {void save(draft);}}><Check size={16} aria-hidden="true"/> {pendingSave === draft.localId ? 'Guardando…' : 'Aprobar y guardar'}</button>
              </div>
            </fieldset>)}
          </div>
          <p className="assist-footnote">Cada tarea se valida y guarda individualmente después de tu aprobación. No hay guardado automático, análisis de texto ni conexión clínica.</p>
        </section>
        <section id="assist-suggestions-panel" role="tabpanel" aria-labelledby="assist-suggestions-tab" hidden={tab !== 'suggestions'}>
          <div className="assist-info"><strong>Solo hechos verificables</strong><p>Estas sugerencias se calculan a partir de las tareas del turno abierto; no son conclusiones de un modelo.</p></div>
          {suggestions.length === 0 && <p className="assist-empty">No hay sugerencias pendientes de revisión.</p>}
          <div className="assist-suggestion-list">
            {suggestions.map((s) => <article className="assist-suggestion" key={s.id}>
              <div className="assist-suggestion-head"><Lightbulb size={18} aria-hidden="true"/><h3>{s.title}</h3></div>
              <p>{s.detail}</p>
              <div className="assist-card-actions">
                <button type="button" className="assist-secondary" onClick={() => onDismissSuggestion(s.id)}>Descartar</button>
                <button type="button" className="assist-primary" onClick={() => onSelectTask(s.taskIds[0])}>Revisar tarea</button>
              </div>
            </article>)}
          </div>
        </section>
        {discardConfirm && <div className="assist-discard-confirm" role="alert" aria-label="Descartar revisión">
          <p>Hay texto o tareas sin guardar. ¿Quieres descartarlos y cerrar?</p>
          <div className="assist-card-actions"><button type="button" onClick={() => setDiscardConfirm(false)}>Seguir revisando</button><button type="button" onClick={discardAndClose}>Descartar y cerrar</button></div>
        </div>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
