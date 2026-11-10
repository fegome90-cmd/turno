import {StrictMode} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OverlayProvider} from '../../src/components/OverlayCoordinator';
import {HistoryHarness} from '../../src/harness/HistoryHarness';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const entries: unknown[] = [null]; let at = 0;
  let held = false;
  const events: (() => void)[] = [];
  const history: History = {
    scrollRestoration: 'auto',
    back() { this.go(-1); }, forward() { this.go(1); },
    get state() { return entries[at]; }, get length() { return entries.length; },
    replaceState(state: unknown) { entries[at] = structuredClone(state); },
    pushState(state: unknown) { entries.splice(at + 1); entries.push(structuredClone(state)); at++; },
    go(delta = 0) {
      const next = at + delta; if (next < 0 || next >= entries.length) return;
      at = next; const state = entries[at];
      queueMicrotask(() => {
        const deliver = () => window.dispatchEvent(new PopStateEvent('popstate', {state}));
        if (held) events.push(deliver); else deliver();
      });
    },
  };
  vi.spyOn(window, 'history', 'get').mockReturnValue(history);
  render(<StrictMode><OverlayProvider><HistoryHarness /></OverlayProvider></StrictMode>);
  return {history, user: userEvent.setup(), index: () => at,
    hold() { held = true; },
    release() { held = false; for (const deliver of events.splice(0)) deliver(); },
    queued: () => events.length,
  };
}

describe('G2B · technical guard harness (simulated history, not browser evidence)', () => {
  it.each([-1, 1].flatMap((direction) => ['discard', 'save'].flatMap((decision) => ['Borrador', 'Título'].map((field) => ({direction, decision, field})))))('a fresh $field edit after approved $decision $direction and before replay delivery keeps the new draft and source', async ({direction, decision, field}) => {
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 1'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 2'}));
    ctx.history.go(-1);
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1'));
    await ctx.user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'Anterior');
    ctx.history.go(direction);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await waitFor(() => expect(ctx.index()).toBe(1));
    ctx.hold();
    if (decision === 'discard') await ctx.user.click(screen.getByRole('button', {name: 'Descartar'}));
    else {
      await ctx.user.click(screen.getByRole('button', {name: 'Guardar y continuar'}));
      await ctx.user.click(screen.getByRole('button', {name: 'Resolver éxito'}));
    }
    await waitFor(() => expect(ctx.queued()).toBeGreaterThan(0));
    expect(ctx.index()).toBe(1 + direction);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', {name: field}), {target: {value: 'Nuevo texto exacto  '}});
    await act(async () => { ctx.release(); });
    await waitFor(() => expect(ctx.index()).toBe(1));
    expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1');
    expect(screen.getByRole('textbox', {name: field})).toHaveValue('Nuevo texto exacto  ');
    expect(screen.getByRole('status')).toHaveTextContent('dirty');
    expect(document.title).toBe(field === 'Título' ? 'Nuevo texto exacto · Turno' : 'Tarea 1 · Turno');
    ctx.history.go(direction);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await ctx.user.click(screen.getByRole('button', {name: 'Descartar'}));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent(direction < 0 ? 'home:' : 'workspace:task-2'));
    expect(ctx.history.length).toBe(3);
  });

  it('cancel and failed save conserve draft; success continues the original Forward', async () => {
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 1'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 2'}));
    ctx.history.go(-1);
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1'));
    const field = screen.getByRole('textbox', {name: 'Borrador'});
    await ctx.user.type(field, 'Literal 31/02/2026  ');
    ctx.history.go(1);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await waitFor(() => expect(ctx.index()).toBe(1));
    await ctx.user.click(screen.getByRole('button', {name: 'Volver'}));
    expect(field).toHaveValue('Literal 31/02/2026  ');
    ctx.history.go(1);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await ctx.user.click(screen.getByRole('button', {name: 'Guardar y continuar'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Resolver fallo'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Fallo simulado');
    expect(field).toHaveValue('Literal 31/02/2026  '); expect(ctx.index()).toBe(1);
    await ctx.user.click(screen.getByRole('button', {name: 'Guardar y continuar'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Resolver éxito'}));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-2'));
    expect(ctx.index()).toBe(2); expect(ctx.history.length).toBe(3);
    expect(document.title).toBe('Revisar insumos · Turno');
  });

  it('late successful save leaves a newer selection and draft untouched', async () => {
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 1'}));
    await ctx.user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'Viejo');
    ctx.history.go(-1);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await ctx.user.click(screen.getByRole('button', {name: 'Guardar y continuar'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Volver'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 2'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Descartar'}));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-2'));
    await ctx.user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'Más reciente');
    await ctx.user.click(screen.getByRole('button', {name: 'Resolver respuesta antigua'}));
    expect(screen.getByRole('textbox', {name: 'Borrador'})).toHaveValue('Más reciente');
    expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-2');
    expect(document.title).toBe('Revisar insumos · Turno');
  });

  it('cancel while saving invalidates its completion even without a newer navigation', async () => {
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 1'}));
    await ctx.user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'Conservar');
    ctx.history.go(-1);
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    await ctx.user.click(screen.getByRole('button', {name: 'Guardar y continuar'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Volver'}));
    await ctx.user.click(screen.getByRole('button', {name: 'Resolver respuesta antigua'}));
    await waitFor(() => expect(ctx.index()).toBe(1));
    expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1');
    expect(screen.getByRole('textbox', {name: 'Borrador'})).toHaveValue('Conservar');
  });

  it('does not present a new editable route while the closing modal still owns focus', async () => {
    // JSDOM lacks getAnimations, so Base UI otherwise completes close synchronously.
    // Exercise its asynchronous browser branch without claiming browser/focus evidence.
    const hadAnimations = Object.hasOwn(Element.prototype, 'getAnimations');
    const previousAnimations = Element.prototype.getAnimations;
    Element.prototype.getAnimations = () => [];
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 1'}));
    await ctx.user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'Pendiente');
    await ctx.user.click(screen.getByRole('button', {name: 'Tarea 2'}));
    await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
    let navigatedUnderModal = false;
    const observer = new MutationObserver(() => {
      if (screen.getByTestId('route').textContent === 'workspace:task-2' && document.querySelector('[role="dialog"]')) navigatedUnderModal = true;
    });
    observer.observe(document.body, {childList: true, characterData: true, subtree: true});
    try {
      await ctx.user.click(screen.getByRole('button', {name: 'Descartar'}));
      await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-2'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(navigatedUnderModal).toBe(false);
    } finally {
      observer.disconnect();
      if (hadAnimations) Element.prototype.getAnimations = previousAnimations;
      else Reflect.deleteProperty(Element.prototype, 'getAnimations');
    }
  });
});
