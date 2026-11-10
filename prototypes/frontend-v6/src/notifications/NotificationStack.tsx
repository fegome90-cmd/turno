// Pila de avisos propia (1B, D12), portada del contrato de v5 (src/toasts.mjs). Solo pinta el store:
// - #live (cortés, role=status) para avisos de estado; #live-error (asertiva, role=alert) para errores.
//   Cada aviso se anuncia una vez; la lista visible no es región viva.
// - Suspendida (modal abierto): región inerte y oculta; el anuncio se difiere hasta reanudar.
// - Escape dentro de la pila cierra solo el aviso enfocado; Alt+T enfoca el más reciente sin mover el foco al llegar.
// - Descarte por teclado: foco al cierre que ocupa la misma posición, luego el anterior, luego el destino de respaldo.
//   Descarte por puntero: solo mueve el foco si ya estaba dentro del aviso.
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {DismissModality, NotificationStore} from './notification-store';
import './notifications.css';

type Live = {polite: string; assertive: string};
const EMPTY_LIVE: Live = {polite: '', assertive: ''};

// Texto de las regiones vivas para un estado; no cambia mientras la pila está suspendida.
function liveFor(state: {suspended: boolean; items: {id: string}[]; announcement: {id: string; kind: string; message: string; count: number} | null}, previous: Live): Live {
  if (state.suspended) return previous;
  const announcement = state.announcement;
  if (!announcement) return previous;
  if (!state.items.some((item) => item.id === announcement.id)) {
    return previous.polite || previous.assertive ? EMPTY_LIVE : previous;
  }
  const text = announcement.count > 1 ? `${announcement.message} Repetido ${announcement.count} veces.` : announcement.message;
  return announcement.kind === 'error' ? {polite: '', assertive: text} : {polite: text, assertive: ''};
}

export function NotificationStack({
  store,
  onFallbackFocus,
}: {
  store: NotificationStore;
  onFallbackFocus?: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const listRef = useRef<HTMLOListElement>(null);
  const modalityRef = useRef<DismissModality>('pointer');
  const [live, setLive] = useState<Live>(() => liveFor(store.getState(), EMPTY_LIVE));

  // Modalidad de la última interacción (como getModality de v5).
  useEffect(() => {
    const onKeyboard = () => {
      modalityRef.current = 'keyboard';
    };
    const onPointer = () => {
      modalityRef.current = 'pointer';
    };
    document.addEventListener('keydown', onKeyboard, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKeyboard, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  // Alt/Option+T: T lógico o posición física KeyT (Option puede cambiar el carácter).
  // Foco al aviso más reciente, sin foco automático al llegar.
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 't' && event.code !== 'KeyT') return;
      const current = store.getState();
      if (current.suspended || current.items.length === 0) return;
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-close-notice]');
      const latest = buttons[buttons.length - 1];
      if (!latest) return;
      event.preventDefault();
      latest.focus();
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, [store]);

  // Anuncio: una vez por aviso notificado; diferido mientras la pila está suspendida. Se actualiza desde la
  // suscripción al store (no dentro del cuerpo de un efecto), así que cada cambio se anuncia una sola vez.
  useEffect(
    () =>
      store.subscribe(() => {
        setLive((previous) => {
          const next = liveFor(store.getState(), previous);
          return next === previous ? previous : next;
        });
      }),
    [store],
  );

  // Descarte: foco como v5 solo si estaba dentro del aviso; después se retira del store.
  const dismissNotice = (id: string, modality: DismissModality) => {
    const list = listRef.current;
    if (list) {
      const notices = Array.from(list.querySelectorAll<HTMLElement>('[data-notice]'));
      const index = notices.findIndex((node) => node.dataset.noticeId === id);
      const current = notices[index];
      if (current && current.contains(document.activeElement)) {
        const remaining = notices.filter((_, position) => position !== index);
        const next = remaining[Math.min(index, remaining.length - 1)];
        const button = next?.querySelector<HTMLButtonElement>('[data-close-notice]');
        if (button) button.focus();
        else onFallbackFocus?.();
      }
    }
    store.dismiss(id, modality);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== 'Escape') return;
    const notice = (event.target as HTMLElement).closest<HTMLElement>('[data-notice]');
    if (!notice?.dataset.noticeId) return;
    event.preventDefault();
    event.stopPropagation();
    dismissNotice(notice.dataset.noticeId, 'keyboard');
  };

  return (
    <>
      <div id="live" role="status" aria-live="polite" className="sr-only">
        {live.polite}
      </div>
      <div id="live-error" role="alert" aria-live="assertive" className="sr-only">
        {live.assertive}
      </div>
      <section
        className="notification-region"
        data-notification-root=""
        inert={state.suspended}
        hidden={state.items.length === 0}
        style={state.suspended ? {visibility: 'hidden'} : undefined}
        aria-label="Avisos"
      >
        <ol className="notice-list" ref={listRef} onKeyDown={onListKeyDown}>
          {state.items.map((item) => (
            <li key={item.id} className="notice" data-notice="" data-notice-id={item.id} data-kind={item.kind}>
              <div className="notice-card">
                <div className="notice-content">
                  <p className="notice-label">{item.kind === 'error' ? 'No se pudo completar' : 'Demostración'}</p>
                  <p className="notice-message" data-notice-message="">
                    {item.message}
                  </p>
                  {item.count > 1 ? <p className="notice-repeat">{`Repetido ${item.count} veces`}</p> : null}
                </div>
                <button
                  type="button"
                  className="notice-close"
                  data-close-notice=""
                  aria-label="Cerrar aviso"
                  onClick={() => dismissNotice(item.id, modalityRef.current)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
