// Independent regressions: all ten failed on fd777bf before the implementation fix.
import {StrictMode, useState} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useHistory} from '../../src/navigation/use-history';
import {OverlayProvider} from '../../src/components/OverlayCoordinator';
import {HistoryHarness} from '../../src/harness/HistoryHarness';
import type {Route} from '../../src/domain/types';

const HOME: Route = {view: 'home', selected: null, archiveId: null};
const TASK: Route = {view: 'workspace', selected: {kind: 'task', id: 'task-1'}, archiveId: null};
afterEach(() => vi.restoreAllMocks());

function controlledHistory() {
  const entries: unknown[] = [null];
  const heldEvents: unknown[] = [];
  const heldMoves: number[] = [];
  let at = 0; let holdEvent = false; let holdMove = false;
  const emit = (state: unknown) => {
    if (holdEvent) heldEvents.push(state);
    else queueMicrotask(() => window.dispatchEvent(new PopStateEvent('popstate', {state})));
  };
  const move = (delta: number) => {
    const next = at + delta;
    if (next < 0 || next >= entries.length) return;
    at = next; emit(entries[at]);
  };
  const history: History = {
    scrollRestoration: 'auto',
    get state() { return entries[at]; },
    get length() { return entries.length; },
    back() { this.go(-1); }, forward() { this.go(1); },
    replaceState(value) { entries[at] = structuredClone(value); },
    pushState(value) { entries.splice(at + 1); entries.push(structuredClone(value)); at++; },
    go(delta = 0) { if (holdMove) heldMoves.push(delta); else move(delta); },
  };
  return {
    history,
    get index() { return at; },
    hold(mode: 'move' | 'event') { holdEvent = mode === 'event'; holdMove = mode === 'move'; },
    release() {
      holdMove = false; holdEvent = false;
      for (const delta of heldMoves.splice(0)) move(delta);
      for (const state of heldEvents.splice(0)) window.dispatchEvent(new PopStateEvent('popstate', {state}));
    },
  };
}

describe('G2B · independently reproduced React batching regressions', () => {
  function fixture() {
    const browser = controlledHistory();
    function App() {
      const [route, setRoute] = useState(HOME);
      const controller = useHistory({
        history: browser.history, subscribePopState: () => () => {},
        readRoute: () => route, applyRoute: setRoute, guardNavigation: () => 'allow',
        setTitle(next) { document.title = next.view; },
      });
      return <><output>{route.view}</output><button onClick={() => { controller.push(TASK); controller.push(HOME); }}>Round trip</button><button onClick={() => { controller.push(TASK); controller.push(TASK); }}>Duplicate</button></>;
    }
    render(<StrictMode><App /></StrictMode>);
    return browser;
  }
  it('TASK then HOME in one React event keeps HOME', () => {
    const browser = fixture(); fireEvent.click(screen.getByText('Round trip'));
    expect(screen.getByRole('status')).toHaveTextContent('home');
    expect(browser.history.state).toMatchObject({view: 'home', idx: 2}); expect(document.title).toBe('home');
  });
  it('same TASK twice in one React event only adds one entry', () => {
    const browser = fixture(); fireEvent.click(screen.getByText('Duplicate'));
    expect(screen.getByRole('status')).toHaveTextContent('workspace'); expect(browser.history.length).toBe(2);
  });
});

describe('G2B · independently reproduced draft revision regressions', () => {
  for (const mode of ['move', 'event'] as const) {
    for (const name of ['Título', 'Borrador']) {
      for (const decision of ['Descartar', 'Guardar y continuar']) {
        it(`new ${name} after ${decision}, before replay ${mode}, survives and re-prompts`, async () => {
          const browser = controlledHistory(); vi.spyOn(window, 'history', 'get').mockReturnValue(browser.history);
          render(<StrictMode><OverlayProvider><HistoryHarness /></OverlayProvider></StrictMode>);
          const user = userEvent.setup();
          await user.click(screen.getByRole('button', {name: 'Tarea 1'}));
          await user.click(screen.getByRole('button', {name: 'Tarea 2'}));
          await act(async () => browser.history.go(-1));
          await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1'));
          await user.type(screen.getByRole('textbox', {name: 'Borrador'}), 'old');
          await act(async () => browser.history.go(-1));
          await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
          await waitFor(() => expect(browser.index).toBe(1));
          browser.hold(mode);
          await user.click(screen.getByRole('button', {name: decision}));
          if (decision === 'Guardar y continuar') await user.click(screen.getByRole('button', {name: 'Resolver éxito'}));
          await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
          fireEvent.change(screen.getByRole('textbox', {name}), {target: {value: 'NEW literal  '}});
          await act(async () => browser.release());
          await waitFor(() => expect(browser.index).toBe(1));
          expect(screen.getByTestId('route')).toHaveTextContent('workspace:task-1');
          expect(screen.getByRole('textbox', {name})).toHaveValue('NEW literal  ');
          expect(browser.history.length).toBe(3);
          await act(async () => browser.history.go(-1));
          await screen.findByRole('dialog', {name: 'Cambios sin guardar'});
          await user.click(screen.getByRole('button', {name: 'Volver'}));
          expect(screen.getByRole('textbox', {name})).toHaveValue('NEW literal  ');
        });
      }
    }
  }
});
