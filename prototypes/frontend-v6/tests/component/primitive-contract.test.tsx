import {StrictMode, useState} from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {TemporalField, validateTemporal} from '../../src/components/TemporalField';
import {createNotificationStore, type NotificationStore} from '../../src/notifications/notification-store';
import {NotificationStack} from '../../src/notifications/NotificationStack';
import {HarnessApp} from '../../src/harness/Harness';
import {EMPTY_OVERLAYS, overlayReducer} from '../../src/components/OverlayCoordinator';

// Casos del encargo 1B. NumberField retirado por D11: su contrato de texto crudo está en evidence/1B/numberfield-probe-output.txt.

describe('G1B-TEMPORAL-RAW · TemporalField (Field + input text) con la regla v5', () => {
  function Harness({kind = 'minutes' as const, initial = ''}: {kind?: 'time' | 'minutes'; initial?: string}) {
    const [value, setValue] = useState(initial);
    return <TemporalField id="estimate" label="Estimación" kind={kind} value={value} onValueChange={setValue} />;
  }

  for (const raw of ['abc', '-1', '1.5', '1441']) {
    it(`G1B-TEMPORAL-RAW · "${raw}" queda visible tal cual y muestra el error v5`, async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const input = screen.getByRole('textbox', {name: 'Estimación'}) as HTMLInputElement;
      await user.type(input, raw);
      expect(input.value).toBe(raw);
      await user.tab();
      expect(input.value).toBe(raw);
      expect(screen.getByText('Estimación: usa minutos enteros entre 0 y 1440.')).toBeInTheDocument();
    });
  }

  it('G1B-TEMPORAL-RAW · 0, 1440 y vacío son válidos; vacío no se convierte en 0', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', {name: 'Estimación'}) as HTMLInputElement;
    await user.type(input, '0');
    expect(input.value).toBe('0');
    expect(screen.queryByText(/usa minutos/)).toBeNull();
    await user.clear(input);
    expect(input.value).toBe('');
    expect(screen.queryByText(/usa minutos/)).toBeNull();
  });

  it('G1B-TEMPORAL-RAW · 999 y 1000 no se acotan (sin clamp) y 1441 es error', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', {name: 'Estimación'}) as HTMLInputElement;
    await user.type(input, '999');
    expect(input.value).toBe('999');
    await user.type(input, '9');
    expect(input.value).toBe('9999');
    await user.clear(input);
    await user.type(input, '1000');
    expect(input.value).toBe('1000');
    expect(screen.queryByText(/usa minutos/)).toBeNull();
  });

  it('G1B-TEMPORAL-RAW · hora 24 h: 24:00 y 9:5 son error; 14:30 es válido', () => {
    expect(validateTemporal('time', 'Hora prevista', '24:00')).toBe('Hora prevista: usa una hora de 24 horas, por ejemplo 14:30.');
    expect(validateTemporal('time', 'Hora prevista', '9:5')).not.toBeNull();
    expect(validateTemporal('time', 'Hora prevista', '14:30')).toBeNull();
    expect(validateTemporal('time', 'Hora prevista', '  ')).toBeNull();
  });

  it('G1B-TEMPORAL-RAW · la regla v5 de minutos: entero 0–1440, sin signo ni decimales', () => {
    const label = 'Estimación';
    expect(validateTemporal('minutes', label, '1440')).toBeNull();
    expect(validateTemporal('minutes', label, '0')).toBeNull();
    expect(validateTemporal('minutes', label, '1441')).not.toBeNull();
    expect(validateTemporal('minutes', label, '-1')).not.toBeNull();
    expect(validateTemporal('minutes', label, '1.5')).not.toBeNull();
    expect(validateTemporal('minutes', label, 'abc')).not.toBeNull();
    expect(validateTemporal('minutes', label, '')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Capas: OverlayCoordinator como única autoridad (Drawer → Popover, Drawer → Dialog).
// ---------------------------------------------------------------------------


function renderHarness(store: NotificationStore = createNotificationStore()) {
  return render(<HarnessApp store={store} />);
}

describe('G1B-OVERLAY · autoridad del coordinador (reductor puro)', () => {
  const nav = {id: 'navigation', kind: 'navigation' as const, returnFocusKey: 'open-nav'};
  const more = {id: 'more:drawer', kind: 'more' as const, returnFocusKey: 'open-more-drawer'};
  const create = {id: 'create', kind: 'create' as const, returnFocusKey: 'open-create-drawer'};

  it('G1B-OVERLAY-06 · Drawer → Popover → Dialog: el Dialog retira el Popover y el Drawer queda debajo', () => {
    let state = overlayReducer(EMPTY_OVERLAYS, {type: 'open', layer: nav});
    state = overlayReducer(state, {type: 'open', layer: more});
    expect(state.layers.map((l) => l.id)).toEqual(['navigation', 'more:drawer']);
    state = overlayReducer(state, {type: 'open', layer: create});
    expect(state.layers.map((l) => l.id)).toEqual(['navigation', 'create']);
  });

  it('G1B-OVERLAY-07 · closeTop retira solo la capa superior; abrir una capa existente no la duplica', () => {
    let state = overlayReducer(EMPTY_OVERLAYS, {type: 'open', layer: nav});
    state = overlayReducer(state, {type: 'open', layer: create});
    state = overlayReducer(state, {type: 'open', layer: create});
    expect(state.layers).toHaveLength(2);
    state = overlayReducer(state, {type: 'closeTop'});
    expect(state.layers.map((l) => l.id)).toEqual(['navigation']);
    state = overlayReducer(state, {type: 'close', id: 'inexistente'});
    expect(state.layers.map((l) => l.id)).toEqual(['navigation']);
  });

  it('G1B-OVERLAY-08 · cerrar muchas veces no deja capas huérfanas', () => {
    let state = EMPTY_OVERLAYS;
    for (let i = 0; i < 20; i += 1) {
      state = overlayReducer(state, {type: 'open', layer: create});
      state = overlayReducer(state, {type: 'close', id: 'create'});
      state = overlayReducer(state, {type: 'closeTop'});
    }
    expect(state.layers).toHaveLength(0);
  });
});

describe('G1B-OVERLAY · capas con un único coordinador', () => {
  it('G1B-OVERLAY-01 · Drawer → Popover: Escape cierra solo el Popover de tema y el Drawer sigue abierto', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    const drawer = await screen.findByRole('dialog', {name: 'Navegación'});
    await user.click(within(drawer).getByRole('button', {name: 'Más opciones'}));
    const popover = await screen.findByRole('dialog', {name: 'Más opciones'});
    expect(popover).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Más opciones'})).toBeNull());
    expect(screen.getByRole('dialog', {name: 'Navegación'})).toBeInTheDocument();
  });

  it('G1B-OVERLAY-02 · abrir Dialog desde Drawer cierra el Popover; Escape cierra el Dialog y el foco vuelve a un destino visible', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    const drawer = await screen.findByRole('dialog', {name: 'Navegación'});
    await user.click(within(drawer).getByRole('button', {name: 'Más opciones'}));
    await screen.findByRole('dialog', {name: 'Más opciones'});
    // Por teclado: sin pulsación fuera que cierre el Popover por su cuenta; lo cierra el coordinador.
    const createButton = within(drawer).getByRole('button', {name: 'Crear tarea'});
    act(() => createButton.focus());
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', {name: 'Crear tarea'});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Más opciones'})).toBeNull());
    expect(dialog).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Crear tarea'})).toBeNull());
    // El destino de retorno (botón de Crear dentro del Drawer) sigue visible: el foco debe estar ahí.
    expect(document.activeElement).toBe(within(drawer).getByRole('button', {name: 'Crear tarea'}));
  });

  it('G1B-OVERLAY-03 · con Dialog abierto, el resto de la página no es accesible', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    await screen.findByRole('dialog', {name: 'Navegación'});
    await user.click(screen.getByRole('button', {name: 'Crear tarea'}));
    await screen.findByRole('dialog', {name: 'Crear tarea'});
    // Positivo: el control de Crear existe en el DOM; sin accesibilidad por estar fuera del modal.
    expect(document.querySelector('[data-focus-key="open-create-page"]')).not.toBeNull();
    expect(screen.queryByRole('button', {name: 'Abrir navegación'})).toBeNull();
  });

  it('G1B-OVERLAY-04 · Tab sale del Popover de tema (no modal, sin trampa)', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    const drawer = await screen.findByRole('dialog', {name: 'Navegación'});
    await user.click(within(drawer).getByRole('button', {name: 'Más opciones'}));
    const popover = await screen.findByRole('dialog', {name: 'Más opciones'});
    const inside = within(popover).getAllByRole('button');
    inside[inside.length - 1].focus();
    await user.tab();
    await user.tab();
    expect(popover.contains(document.activeElement)).toBe(false);
  });

  it('G1B-OVERLAY-05 · abrir y cerrar Dialog 20 veces durante la animación no deja capas huérfanas', async () => {
    const user = userEvent.setup();
    renderHarness();
    for (let i = 0; i < 20; i += 1) {
      await user.click(screen.getByRole('button', {name: 'Crear tarea'}));
      await screen.findByRole('dialog', {name: 'Crear tarea'});
      await user.keyboard('{Escape}');
    }
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"]').length).toBe(0));
    expect(document.body.querySelectorAll('[data-overlay-layer]').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edición nativa en la jsdom: un solo nodo de campo y sin duplicados de portal.
// ---------------------------------------------------------------------------
describe('EXTRA-NATIVE-EDIT · un solo campo y sin duplicados en portales', () => {
  it('EXTRA-NATIVE-EDIT · el campo de Estimación conserva su nodo al cambiar el docking 699↔700', async () => {
    const user = userEvent.setup();
    renderHarness();
    const field = screen.getByRole('textbox', {name: 'Estimación'});
    await user.type(field, '1.5');
    fireEvent.click(screen.getByRole('button', {name: 'Alternar banda'}));
    expect(screen.getByRole('textbox', {name: 'Estimación'})).toBe(field);
    expect((field as HTMLInputElement).value).toBe('1.5');
    expect(screen.getByText('Estimación: usa minutos enteros entre 0 y 1440.')).toBeInTheDocument();
  });

  it('EXTRA-NATIVE-EDIT · abrir un portal no duplica el campo editable', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    const drawer = await screen.findByRole('dialog', {name: 'Navegación'});
    await user.click(within(drawer).getByRole('button', {name: 'Crear tarea'}));
    await screen.findByRole('dialog', {name: 'Crear tarea'});
    // Con modal abierto el resto queda oculto para la accesibilidad: se cuenta el nodo del campo en el DOM.
    expect(document.querySelectorAll('#estimate')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Avisos (D12): pila propia dirigida solo por notification-store. Portada del contrato de v5 (src/toasts.mjs).
// ---------------------------------------------------------------------------
const CSS_PATH = path.resolve('src/notifications/notifications.css');

describe('G1B-NOTIFY · pila propia (D12)', () => {
  it('G1B-NOTIFY-01 · 30 avisos (15 estado y 15 errores): ninguno se expulsa y el presupuesto de desplazamiento es explícito', () => {
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    act(() => {
      for (let i = 0; i < 15; i += 1) {
        store.notify(`Estado ${i}`, 'status');
        store.notify(`Error ${i}`, 'error');
      }
    });
    expect(store.getState().items).toHaveLength(30);
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(30);
    for (let i = 0; i < 15; i += 1) expect(document.body.textContent).toContain(`Error ${i}`);
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    expect(css).toMatch(/\.notice-list\{[^}]*max-height:min\(40dvh,420px\)[^}]*overflow-y:auto/);
  });

  it('G1B-NOTIFY-02 · repetir el mismo aviso suma en el contador y no crea otro elemento', () => {
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    let id = '';
    act(() => {
      id = store.notify('Guardado', 'status');
    });
    act(() => {
      expect(store.notify('Guardado', 'status')).toBe(id);
    });
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].count).toBe(2);
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(1);
    expect(document.querySelector('[data-notice]')?.textContent).toContain('Repetido 2 veces');
  });

  it('G1B-NOTIFY-03 · estado va a la región cortés y error a la región asertiva; un solo anuncio por aviso', () => {
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    const polite = document.getElementById('live');
    const assertive = document.getElementById('live-error');
    expect(polite?.getAttribute('role')).toBe('status');
    expect(polite?.getAttribute('aria-live')).toBe('polite');
    expect(assertive?.getAttribute('role')).toBe('alert');
    expect(assertive?.getAttribute('aria-live')).toBe('assertive');
    act(() => {
      store.notify('Guardado', 'status');
    });
    expect(polite?.textContent).toBe('Guardado');
    expect(assertive?.textContent).toBe('');
    act(() => {
      store.notify('No se pudo guardar', 'error');
    });
    expect(assertive?.textContent).toBe('No se pudo guardar');
    expect(polite?.textContent).toBe('');
    // Un solo anuncio: el texto aparece en exactamente una región viva.
    const occurrences = [polite, assertive].filter((node) => node?.textContent?.includes('No se pudo guardar')).length;
    expect(occurrences).toBe(1);
    // La lista de avisos no es región viva: no duplica el anuncio.
    expect(document.querySelector('.notice-list')?.getAttribute('aria-live')).toBeNull();
  });

  it('G1B-NOTIFY-04 · con modal abierto la pila queda inerte y oculta; el anuncio se difiere hasta cerrar', () => {
    const store = createNotificationStore();
    const {container} = render(<NotificationStack store={store} />);
    act(() => {
      store.notify('Previo', 'status');
    });
    act(() => store.setSuspended(true));
    act(() => {
      store.notify('Mientras modal', 'error');
    });
    const root = container.querySelector('[data-notification-root]') as HTMLElement;
    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.style.visibility).toBe('hidden');
    expect(document.getElementById('live-error')?.textContent).toBe('');
    act(() => store.setSuspended(false));
    expect(root.hasAttribute('inert')).toBe(false);
    expect(root.style.visibility).toBe('');
    expect(document.getElementById('live-error')?.textContent).toBe('Mientras modal');
  });

  it('G1B-NOTIFY-05 · descarte por teclado de un aviso intermedio mueve el foco al cierre siguiente, como v5', async () => {
    const user = userEvent.setup();
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    act(() => {
      for (const message of ['Uno', 'Dos', 'Tres']) store.notify(message, 'status');
    });
    const closes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-close-notice]'));
    expect(closes()).toHaveLength(3);
    closes()[1].focus();
    await user.keyboard('{Enter}');
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(2);
    expect(document.activeElement).toBe(closes()[1]);
    expect(document.activeElement?.closest('[data-notice]')?.textContent).toContain('Tres');
  });

  it('G1B-NOTIFY-06 · descarte por teclado del último: foco al anterior; sin más avisos, al destino de respaldo', async () => {
    const user = userEvent.setup();
    const store = createNotificationStore();
    const fallback = vi.fn();
    render(<NotificationStack store={store} onFallbackFocus={fallback} />);
    act(() => {
      store.notify('Uno', 'status');
      store.notify('Dos', 'status');
    });
    const closes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-close-notice]'));
    closes()[1].focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(closes()[0]);
    await user.keyboard('{Enter}');
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(0);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('G1B-NOTIFY-07 · descarte por puntero no mueve un foco ajeno a la pila', () => {
    const store = createNotificationStore();
    render(
      <>
        <button type="button">Fuera de la pila</button>
        <NotificationStack store={store} />
      </>,
    );
    act(() => {
      store.notify('Uno', 'status');
      store.notify('Dos', 'status');
    });
    const outside = screen.getByRole('button', {name: 'Fuera de la pila'});
    outside.focus();
    // fireEvent no mueve el foco: el clic de ratón del navegador sí, y ahí el foco ya es parte de la pila.
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('[data-close-notice]')[0]);
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(1);
    expect(document.activeElement).toBe(outside);
  });

  it('G1B-NOTIFY-08 · Escape dentro de la pila cierra solo el aviso enfocado', async () => {
    const user = userEvent.setup();
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    act(() => {
      store.notify('Uno', 'status');
      store.notify('Dos', 'status');
    });
    document.querySelectorAll<HTMLButtonElement>('[data-close-notice]')[1].focus();
    await user.keyboard('{Escape}');
    expect(store.getState().items.map((item) => item.message)).toEqual(['Uno']);
    expect(document.querySelectorAll('[data-notice]')).toHaveLength(1);
    // Fuera de la pila, Escape no cierra nada.
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Escape}');
    expect(store.getState().items).toHaveLength(1);
  });

  it.each([
    ['t lógico sin code', 't', ''],
    ['T lógico en otra posición', 'T', 'KeyY'],
    ['Option transforma el carácter', '†', 'KeyT'],
    ['posición física con otro carácter', 'ø', 'KeyT'],
  ])('G1B-NOTIFY-09 · %s enfoca el último cierre y cancela la acción por defecto', (_label, key, code) => {
    const store = createNotificationStore();
    render(<><textarea aria-label="Borrador" defaultValue="Texto pendiente" /><NotificationStack store={store} /></>);
    const editor = screen.getByRole('textbox', {name: 'Borrador'});
    editor.focus();
    act(() => {
      store.notify('Uno', 'status');
      store.notify('Dos', 'error');
    });
    const closes = screen.getAllByRole('button', {name: 'Cerrar aviso'});
    expect(closes).toHaveLength(2);
    expect(editor).toHaveFocus();
    const event = new KeyboardEvent('keydown', {key, code, altKey: true, bubbles: true, cancelable: true});
    fireEvent(editor, event);
    expect.soft(event.defaultPrevented).toBe(true);
    expect.soft(closes[1]).toHaveFocus();
    // JSDOM no inserta texto por defecto: la supresión real de † requiere Safari nativo.
    expect(editor).toHaveValue('Texto pendiente');
    expect(store.getState().items).toHaveLength(2);
  });

  it.each([
    ['sin Alt', {altKey: false}],
    ['Ctrl', {ctrlKey: true}],
    ['Meta', {metaKey: true}],
    ['Shift', {shiftKey: true}],
    ['otra tecla', {key: 'ø', code: 'KeyY'}],
    ['composición', {isComposing: true}],
    ['evento consumido', {}],
  ])('G1B-NOTIFY-09 · %s no roba foco ni consume el evento', (label, overrides) => {
    const store = createNotificationStore();
    render(<><textarea aria-label="Borrador" defaultValue="Texto pendiente" /><NotificationStack store={store} /></>);
    act(() => {store.notify('Uno', 'error');});
    expect(screen.getByRole('button', {name: 'Cerrar aviso'})).toBeVisible();
    const editor = screen.getByRole('textbox', {name: 'Borrador'});
    editor.focus();
    const event = new KeyboardEvent('keydown', {key: 't', code: 'KeyT', altKey: true, bubbles: true, cancelable: true, ...overrides});
    if (label === 'evento consumido') event.preventDefault();
    fireEvent(editor, event);
    expect.soft(editor).toHaveFocus();
    expect.soft(event.defaultPrevented).toBe(label === 'evento consumido');
    expect(editor).toHaveValue('Texto pendiente');
    expect(store.getState().items).toHaveLength(1);
  });

  it.each(['vacía', 'suspendida'])('G1B-NOTIFY-09 · pila %s no roba foco ni consume Option+T', (state) => {
    const store = createNotificationStore();
    render(<><textarea aria-label="Borrador" defaultValue="Texto pendiente" /><NotificationStack store={store} /></>);
    if (state === 'suspendida') {
      act(() => {store.notify('Uno', 'error'); store.setSuspended(true);});
      expect(document.querySelector('[data-close-notice]')).toBeInTheDocument();
      expect(document.querySelector('[data-notification-root]')).toHaveAttribute('inert');
    } else {
      expect(document.querySelector('[data-close-notice]')).not.toBeInTheDocument();
    }
    const editor = screen.getByRole('textbox', {name: 'Borrador'});
    editor.focus();
    const event = new KeyboardEvent('keydown', {key: '†', code: 'KeyT', altKey: true, bubbles: true, cancelable: true});
    fireEvent(editor, event);
    expect(editor).toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
    expect(editor).toHaveValue('Texto pendiente');
  });

  it('G1B-NOTIFY-10 · el texto del aviso es literal: no se interpreta como HTML', () => {
    const store = createNotificationStore();
    render(<NotificationStack store={store} />);
    act(() => {
      store.notify('<img src=x onerror=alert(1)>', 'status');
    });
    const message = document.querySelector('[data-notice] [data-notice-message]') as HTMLElement;
    expect(message.children).toHaveLength(0);
    expect(message.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('G1B-NOTIFY-11 · un aviso que no se puede crear no devuelve identificador ni cuenta como éxito', () => {
    const store = createNotificationStore();
    expect(store.notify('', 'status')).toBe('');
    expect(store.notify('   ', 'status')).toBe('');
    expect(store.getState().items).toHaveLength(0);
  });

  it('G1B-NOTIFY-12 · descartar con Escape o teclado registra la modalidad en el store', () => {
    const store = createNotificationStore();
    const a = store.notify('A', 'status');
    const b = store.notify('B', 'error');
    expect(store.dismiss(a, 'pointer')).toBe(true);
    expect(store.dismiss(b, 'keyboard')).toBe(true);
    expect(store.getState().items).toHaveLength(0);
    expect(store.dismiss(b, 'keyboard')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ciclo de vida (EXTRA-LIFECYCLE-ASYNC): 20 ciclos con listeners al valor inicial y sin anuncios duplicados.
// ---------------------------------------------------------------------------
describe('EXTRA-LIFECYCLE-ASYNC · 20 ciclos de montaje y desmontaje de la pila', () => {
  it('EXTRA-LIFECYCLE-ASYNC · listeners de window/document y matchMedia vuelven a cero; un anuncio por ciclo', () => {
    const net: Record<string, number> = {};
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (this === window || this === document) net[type] = (net[type] ?? 0) + 1;
      return (add as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof add;
    EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (this === window || this === document) net[type] = (net[type] ?? 0) - 1;
      return (remove as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof remove;
    try {
      const cycle = (index: number) => {
        const store = createNotificationStore();
        const root = document.createElement('div');
        document.body.append(root);
        const view = render(<NotificationStack store={store} />, {container: root});
        act(() => {
          store.notify(`Ciclo ${index}`, 'status');
        });
        expect(document.getElementById('live')?.textContent).toBe(`Ciclo ${index}`);
        expect(document.querySelectorAll('[data-notice]')).toHaveLength(1);
        view.unmount();
        root.remove();
      };
      cycle(-1);
      const baseline = {...net};
      for (let index = 0; index < 20; index += 1) cycle(index);
      for (const [type, value] of Object.entries(net)) {
        expect({type, value: value - (baseline[type] ?? 0)}).toEqual({type, value: 0});
      }
    } finally {
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
    }
  });
});

describe('EXTRA-LIFECYCLE-ASYNC · harness completo bajo StrictMode', () => {
  it('EXTRA-LIFECYCLE-ASYNC · 20 ciclos con StrictMode, Drawer y Dialog abiertos: listeners al valor inicial y sin capas huérfanas', async () => {
    const user = userEvent.setup();
    const net: Record<string, number> = {};
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (this === window || this === document) net[type] = (net[type] ?? 0) + 1;
      return (add as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof add;
    EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (this === window || this === document) net[type] = (net[type] ?? 0) - 1;
      return (remove as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof remove;
    const media = {count: 0};
    window.matchMedia = ((query: string) => ({
      media: query,
      matches: false,
      addEventListener() {
        media.count += 1;
      },
      removeEventListener() {
        media.count -= 1;
      },
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    })) as unknown as typeof window.matchMedia;
    const cycle = async () => {
      const store = createNotificationStore();
      const view = render(
        <StrictMode>
          <HarnessApp store={store} />
        </StrictMode>,
      );
      await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
      await screen.findByRole('dialog', {name: 'Navegación'});
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull());
      view.unmount();
    };
    // Calentamiento fuera de la medida: user-event añade su propio listener de selectionchange en el primer uso.
    await cycle();
    const baseline = {...net};
    try {
      for (let index = 0; index < 20; index += 1) await cycle();
      for (const [type, value] of Object.entries(net)) {
        expect({type, value: value - (baseline[type] ?? 0)}).toEqual({type, value: 0});
      }
      expect(media.count).toBe(0);
      expect(document.querySelectorAll('[role="dialog"]').length).toBe(0);
      expect(document.querySelectorAll('[data-overlay-layer]').length).toBe(0);
    } finally {
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
