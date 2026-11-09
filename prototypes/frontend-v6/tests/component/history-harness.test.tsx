import {StrictMode} from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OverlayProvider} from '../../src/components/OverlayCoordinator';
import {HistoryHarness} from '../../src/harness/HistoryHarness';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const entries: unknown[] = [null]; let at = 0;
  const history: History = {
    scrollRestoration: 'auto',
    back() { this.go(-1); }, forward() { this.go(1); },
    get state() { return entries[at]; }, get length() { return entries.length; },
    replaceState(state: unknown) { entries[at] = structuredClone(state); },
    pushState(state: unknown) { entries.splice(at + 1); entries.push(structuredClone(state)); at++; },
    go(delta = 0) {
      const next = at + delta; if (next < 0 || next >= entries.length) return;
      at = next; const state = entries[at];
      queueMicrotask(() => window.dispatchEvent(new PopStateEvent('popstate', {state})));
    },
  };
  vi.spyOn(window, 'history', 'get').mockReturnValue(history);
  render(<StrictMode><OverlayProvider><HistoryHarness /></OverlayProvider></StrictMode>);
  return {history, user: userEvent.setup(), index: () => at};
}

describe('G2B · technical guard harness (simulated history, not browser evidence)', () => {
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
});
