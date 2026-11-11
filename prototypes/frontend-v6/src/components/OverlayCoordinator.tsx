// Coordinador único de capas (1B): Drawer (navegación) → Popover (no modal) o Dialog. El último elemento es el topmost.
// Los componentes de Base UI se controlan desde aquí (open + onOpenChange); ninguno guarda su propio estado de capa.
import {createContext, useContext, useMemo, useReducer, type ReactNode} from 'react';
import {useStore} from 'zustand';
import type {TurnoStore} from '../app/store';

export type OverlayKind = 'navigation' | 'time' | 'more' | 'confirm' | 'create' | 'rename' | 'demo';
export type OverlayLayer = {id: string; kind: OverlayKind; returnFocusKey: string | null};
export type OverlayState = {layers: OverlayLayer[]};
export type OverlayAction = {type: 'open'; layer: OverlayLayer} | {type: 'close'; id: string} | {type: 'closeTop'};
export type OverlayApi = {
  state: OverlayState;
  open(layer: OverlayLayer): void;
  close(id: string): void;
  closeTop(): void;
};

const POPOVER_KINDS: readonly OverlayKind[] = ['time', 'more'];
const MODAL_KINDS: readonly OverlayKind[] = ['navigation', 'confirm', 'create', 'rename', 'demo'];

export const EMPTY_OVERLAYS: OverlayState = {layers: []};

// Reglas: un solo Popover a la vez; un Dialog cierra los Popover previos; una navegación (Drawer) reinicia la pila.
// Abrir una capa que ya existe no la duplica. Cerrar algo que no está abierto no cambia el estado.
export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  if (action.type === 'closeTop') {
    return state.layers.length ? {layers: state.layers.slice(0, -1)} : state;
  }
  if (action.type === 'close') {
    return state.layers.some((layer) => layer.id === action.id)
      ? {layers: state.layers.filter((layer) => layer.id !== action.id)}
      : state;
  }
  const {layer} = action;
  if (state.layers.some((item) => item.id === layer.id)) return state;
  if (layer.kind === 'navigation') return {layers: [layer]};
  // Popover o Dialog: cualquier capa nueva cierra los Popover previos (solo uno a la vez, Dialog cubre Popover).
  const kept = state.layers.filter((item) => !POPOVER_KINDS.includes(item.kind));
  return {layers: [...kept, layer]};
}

export const isLayerOpen = (state: OverlayState, id: string) => state.layers.some((layer) => layer.id === id);
export const isModalKind = (kind: OverlayKind) => MODAL_KINDS.includes(kind);

const Ctx = createContext<OverlayApi | null>(null);

export function OverlayProvider({children, store}: {children: ReactNode; store?: TurnoStore}) {
  return store ? <StoreOverlayProvider store={store}>{children}</StoreOverlayProvider> : <LocalOverlayProvider>{children}</LocalOverlayProvider>;
}

function StoreOverlayProvider({children, store}: {children: ReactNode; store: TurnoStore}) {
  const state = useStore(store, (value) => value.overlays);
  const dispatch = store.getState().dispatchOverlay;
  const api = useMemo<OverlayApi>(() => ({state, open: (layer) => dispatch({type: 'open', layer}), close: (id) => dispatch({type: 'close', id}), closeTop: () => dispatch({type: 'closeTop'})}), [state, dispatch]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

function LocalOverlayProvider({children}: {children: ReactNode}) {
  const [state, dispatch] = useReducer(overlayReducer, EMPTY_OVERLAYS);
  const api = useMemo<OverlayApi>(
    () => ({
      state,
      open: (layer) => dispatch({type: 'open', layer}),
      close: (id) => dispatch({type: 'close', id}),
      closeTop: () => dispatch({type: 'closeTop'}),
    }),
    [state],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOverlays(): OverlayApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useOverlays debe usarse dentro de OverlayProvider');
  return api;
}

// Foco de retorno: el destino marcado por data-focus-key solo si sigue conectado, visible y no inerte.
export function resolveReturnFocus(key: string | null): HTMLElement | false {
  if (!key) return false;
  const node = document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`);
  if (!node || !node.isConnected) return false;
  if (node.closest('[inert],[hidden]')) return false;
  for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return node;
}
