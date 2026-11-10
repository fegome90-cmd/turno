// Fuente de verdad de los avisos (1B, D12). No conoce el DOM. Sin límite: nada se expulsa.
// Un aviso repetido (mismo tipo y texto) suma en `count` y no crea otro elemento, como v5.
// `announcement` es el último aviso notificado (nuevo o repetido); la pila decide cómo anunciarlo.
export type NotificationKind = 'status' | 'error';
export type DismissModality = 'pointer' | 'keyboard';
export type NotificationItem = {id: string; kind: NotificationKind; message: string; count: number};
export type Announcement = {id: string; kind: NotificationKind; message: string; count: number; seq: number};
export type NotificationState = {items: NotificationItem[]; suspended: boolean; announcement: Announcement | null};
export type NotificationStore = {
  // Devuelve el id, o '' si el aviso no es válido (un fallo nunca se reporta como éxito).
  notify(message: string, kind?: NotificationKind): string;
  dismiss(id: string, modality: DismissModality): boolean;
  setSuspended(value: boolean): void;
  clear(): void;
  getState(): NotificationState;
  subscribe(listener: () => void): () => void;
};

// Identidad global: dos stores nunca reutilizan un id.
let globalSerial = 0;

export function createNotificationStore(): NotificationStore {
  let state: NotificationState = {items: [], suspended: false, announcement: null};
  let announceSeq = 0;
  const listeners = new Set<() => void>();
  const emit = (next: NotificationState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    notify(message, kind = 'status') {
      const text = String(message);
      if (!text.trim()) return '';
      const normalized: NotificationKind = kind === 'error' ? 'error' : 'status';
      announceSeq += 1;
      const existing = state.items.find((item) => item.kind === normalized && item.message === text);
      if (existing) {
        const count = existing.count + 1;
        emit({
          ...state,
          items: state.items.map((item) => (item.id === existing.id ? {...item, count} : item)),
          announcement: {id: existing.id, kind: normalized, message: text, count, seq: announceSeq},
        });
        return existing.id;
      }
      globalSerial += 1;
      const id = `n${globalSerial}`;
      emit({
        ...state,
        items: [...state.items, {id, kind: normalized, message: text, count: 1}],
        announcement: {id, kind: normalized, message: text, count: 1, seq: announceSeq},
      });
      return id;
    },
    dismiss(id) {
      if (!state.items.some((item) => item.id === id)) return false;
      emit({...state, items: state.items.filter((item) => item.id !== id)});
      return true;
    },
    setSuspended(value) {
      const next = Boolean(value);
      if (next !== state.suspended) emit({...state, suspended: next});
    },
    clear() {
      emit({...state, items: [], announcement: null});
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
