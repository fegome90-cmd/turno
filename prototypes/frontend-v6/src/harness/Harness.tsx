// Harness de contratos 1B. No es pantalla del producto: solo ejercita primitivas con datos sintéticos.
// Lo carga harness.html y los tests; dist/preview.html no lo importa.
import {useEffect, useRef, useState} from 'react';
import './Harness.css';
import {Dialog} from '@base-ui/react/dialog';
import {Drawer} from '@base-ui/react/drawer';
import {Popover} from '@base-ui/react/popover';
import {AppProviders} from '../app/AppProviders';
import {useTheme, type ThemePreference} from '../appearance/theme-provider';
import {
  isLayerOpen,
  isModalKind,
  OverlayProvider,
  resolveReturnFocus,
  useOverlays,
  type OverlayLayer,
} from '../components/OverlayCoordinator';
import {TemporalField} from '../components/TemporalField';
import {NotificationStack} from '../notifications/NotificationStack';
import type {NotificationStore} from '../notifications/notification-store';

function useMatch(query: string): boolean {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const navLayer: OverlayLayer = {id: 'navigation', kind: 'navigation', returnFocusKey: 'open-nav'};
const createLayer = (returnFocusKey: string): OverlayLayer => ({id: 'create', kind: 'create', returnFocusKey});
const moreLayer = (source: 'page' | 'drawer'): OverlayLayer => ({id: `more:${source}`, kind: 'more', returnFocusKey: `open-more-${source}`});

function ThemePicker() {
  const {preference, setPreference} = useTheme();
  const choices: [ThemePreference, string][] = [
    ['system', 'Sistema'],
    ['light', 'Claro'],
    ['dark', 'Oscuro'],
  ];
  return (
    <div className="theme-picker">
      {choices.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={preference === value} onClick={() => setPreference(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MorePopover({source}: {source: 'page' | 'drawer'}) {
  const {state, open, close} = useOverlays();
  const id = `more:${source}`;
  const isOpen = isLayerOpen(state, id);
  return (
    <Popover.Root
      open={isOpen}
      modal={false}
      onOpenChange={(value) => (value ? open(moreLayer(source)) : close(id))}
    >
      <Popover.Trigger data-focus-key={`open-more-${source}`} type="button">
        Más opciones
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-overlay-layer="more">
            <Popover.Title>Más opciones</Popover.Title>
            <ThemePicker />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NavigationDrawer() {
  const {state, open, close} = useOverlays();
  const isOpen = isLayerOpen(state, 'navigation');
  return (
    <Drawer.Root open={isOpen} onOpenChange={(value) => (value ? open(navLayer) : close('navigation'))}>
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup data-overlay-layer="navigation">
            <Drawer.Title>Navegación</Drawer.Title>
            <MorePopover source="drawer" />
            <button type="button" data-focus-key="open-create-drawer" onClick={() => open(createLayer('open-create-drawer'))}>
              Crear tarea
            </button>
            <Drawer.Close>Cerrar navegación</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CreateDialog() {
  const {state, close} = useOverlays();
  const layer = state.layers.find((item) => item.id === 'create');
  const returnKey = useRef<string | null>(null);
  useEffect(() => {
    if (layer) returnKey.current = layer.returnFocusKey;
  }, [layer]);
  return (
    <Dialog.Root open={Boolean(layer)} onOpenChange={(value) => !value && close('create')}>
      <Dialog.Portal>
        <Dialog.Popup
          data-overlay-layer="create"
          finalFocus={() => resolveReturnFocus(returnKey.current)}
        >
          <Dialog.Title>Crear tarea</Dialog.Title>
          <label>
            Título de la tarea
            <input type="text" />
          </label>
          <Dialog.Close>Cerrar</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Shell({store}: {store: NotificationStore}) {
  const {state, open} = useOverlays();
  const mediaWide700 = useMatch('(min-width: 700px)');
  const mediaWide1000 = useMatch('(min-width: 1000px)');
  const [forced, setForced] = useState<boolean | null>(null);
  const wide700 = forced ?? mediaWide700;
  const wide1000 = forced ?? mediaWide1000;
  const [estimate, setEstimate] = useState('');
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('Revisión de signos vitales del turno con título largo de prueba');

  const suspended = state.layers.some((layer) => isModalKind(layer.kind));
  useEffect(() => {
    store.setSuspended(suspended);
  }, [store, suspended]);

  return (
    <main id="main" tabIndex={-1} data-band={wide700 ? 'wide' : 'narrow'} data-band-1000={wide1000 ? 'wide' : 'narrow'}>
      <h1>Harness 1B</h1>
      <button type="button" data-focus-key="open-nav" onClick={() => open(navLayer)}>
        Abrir navegación
      </button>
      <MorePopover source="page" />
      <button type="button" data-focus-key="open-create-page" onClick={() => open(createLayer('open-create-page'))}>
        Crear tarea
      </button>
      <button type="button" onClick={() => setForced((value) => (value === null ? !mediaWide700 : !value))}>
        Alternar banda
      </button>
      <button
        type="button"
        onClick={() => {
          for (let i = 0; i < 15; i += 1) {
            store.notify(`Estado ${i}`, 'status');
            store.notify(`Error ${i}`, 'error');
          }
        }}
      >
        Generar 30 avisos
      </button>
      <button
        type="button"
        onClick={() => {
          for (const message of ['Aviso 1', 'Aviso 2', 'Aviso 3']) store.notify(message, 'status');
        }}
      >
        Generar 3 avisos
      </button>
      <section aria-label="Editor de prueba">
        <label>
          Título
          <input type="text" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        </label>
        <TemporalField id="time" label="Hora prevista" kind="time" value={time} onValueChange={setTime} />
        <TemporalField id="estimate" label="Estimación" kind="minutes" value={estimate} onValueChange={setEstimate} />
      </section>
      <NavigationDrawer />
      <CreateDialog />
      <NotificationStack store={store} />
    </main>
  );
}

export function HarnessApp({store}: {store: NotificationStore}) {
  return (
    <AppProviders>
      <OverlayProvider>
        <Shell store={store} />
      </OverlayProvider>
    </AppProviders>
  );
}
