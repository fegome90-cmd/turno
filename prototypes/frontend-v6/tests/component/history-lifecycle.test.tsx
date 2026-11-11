import {StrictMode, useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {useHistory} from '../../src/navigation/use-history';
import type {HistoryPort} from '../../src/navigation/history-controller';
import type {Route} from '../../src/domain/types';

describe('G2B · hook effect lifecycle', () => {
  it('the committed normalized selection and latest title callback replace the batched projection', () => {
    const entries: unknown[] = [null];
    const history: HistoryPort = {
      get state() { return entries.at(-1); },
      replaceState(next) { entries[entries.length - 1] = structuredClone(next); },
      pushState(next) { entries.push(structuredClone(next)); }, go() {},
    };
    function Harness() {
      const [route, setRoute] = useState<Route>({view: 'home', selected: null, archiveId: null});
      const [label, setLabel] = useState('Actual');
      const controller = useHistory({history, subscribePopState: () => () => {}, readRoute: () => route,
        applyRoute(next) { setRoute({...next, selected: null}); }, guardNavigation: () => 'allow',
        setTitle(next) { document.title = `${label}:${next.selected?.id ?? next.view}`; },
      });
      return <><button onClick={() => controller.push({view: 'workspace', selected: {kind: 'task', id: 'missing'}, archiveId: null})}>Ausente</button><button onClick={() => controller.push({view: 'workspace', selected: null, archiveId: null})}>Selección efectiva</button><button onClick={() => setLabel('Nuevo')}>Cambiar título</button><output>{route.selected?.id ?? route.view}</output></>;
    }
    render(<StrictMode><Harness /></StrictMode>);
    fireEvent.click(screen.getByRole('button', {name: 'Ausente'}));
    expect(screen.getByRole('status')).toHaveTextContent('workspace');
    expect(document.title).toBe('Actual:workspace');
    fireEvent.click(screen.getByRole('button', {name: 'Selección efectiva'}));
    expect(entries).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', {name: 'Cambiar título'}));
    expect(document.title).toBe('Nuevo:workspace'); expect(entries).toHaveLength(2);
  });

  it.each(['last-home', 'duplicate-task'].flatMap((mode) => [false, true].map((cloneRead) => ({mode, cloneRead}))))('React-batched navigation keeps the latest intent without duplicate entries: $mode, cloned read=$cloneRead', ({mode, cloneRead}) => {
    const entries: unknown[] = [null]; let at = 0;
    const history: HistoryPort = {
      get state() { return entries[at]; },
      replaceState(next) { entries[at] = structuredClone(next); },
      pushState(next) { entries.splice(at + 1); entries.push(structuredClone(next)); at++; },
      go() {},
    };
    const home: Route = {view: 'home', selected: null, archiveId: null};
    const task: Route = {view: 'workspace', selected: {kind: 'task', id: 'task-1'}, archiveId: null};
    function Harness() {
      const [route, setRoute] = useState(home);
      const controller = useHistory({history, subscribePopState: () => () => {},
        readRoute: () => cloneRead ? structuredClone(route) : route, applyRoute: setRoute, guardNavigation: () => 'allow',
        setTitle(next) { document.title = `${next.view} · Turno`; },
      });
      return <><button onClick={() => { controller.push(task); controller.push(mode === 'last-home' ? home : task); }}>Navegar dos veces</button><output>{route.view}</output></>;
    }
    render(<StrictMode><Harness /></StrictMode>);
    fireEvent.click(screen.getByRole('button', {name: 'Navegar dos veces'}));
    const expected = mode === 'last-home' ? home : task;
    expect(screen.getByRole('status')).toHaveTextContent(expected.view);
    expect(document.title).toBe(`${expected.view} · Turno`);
    expect(entries).toHaveLength(mode === 'last-home' ? 3 : 2);
    expect(history.state).toMatchObject({...expected, idx: mode === 'last-home' ? 2 : 1});
  });

  it('a normalizer that bails out of React state still reconciles the effective route and title', () => {
    const entries: unknown[] = [null];
    const history: HistoryPort = {
      get state() { return entries.at(-1); },
      replaceState(next) { entries[entries.length - 1] = structuredClone(next); },
      pushState(next) { entries.push(structuredClone(next)); }, go() {},
    };
    function Harness() {
      const [route, setRoute] = useState<Route>({view: 'workspace', selected: null, archiveId: null});
      const controller = useHistory({history, subscribePopState: () => () => {}, readRoute: () => route,
        applyRoute(next) { setRoute((previous) => next.selected?.id === 'missing' ? previous : next); },
        guardNavigation: () => 'allow', setTitle(next) { document.title = next.selected?.id ?? next.view; },
      });
      return <><button onClick={() => controller.push({view: 'workspace', selected: {kind: 'task', id: 'missing'}, archiveId: null})}>Ausente sin commit</button><button onClick={() => controller.push(route)}>Ruta efectiva</button><output>{route.selected?.id ?? route.view}</output></>;
    }
    render(<StrictMode><Harness /></StrictMode>);
    fireEvent.click(screen.getByRole('button', {name: 'Ausente sin commit'}));
    expect(document.title).toBe('workspace');
    expect(screen.getByRole('status')).toHaveTextContent('workspace');
    fireEvent.click(screen.getByRole('button', {name: 'Ruta efectiva'}));
    expect(entries).toHaveLength(2);
  });

  it('EXTRA-LIFECYCLE-ASYNC · StrictMode plus 20 mounts leaves zero listeners, one initial replace per mount and one push per click', () => {
    const listeners = new Set<(state: unknown) => void>();
    let state: unknown = null;
    let replaces = 0; let pushes = 0;
    const history: HistoryPort = {
      get state() { return state; },
      replaceState(next) { state = next; replaces++; },
      pushState(next) { state = next; pushes++; },
      go() {},
    };
    function Harness() {
      const [route, setRoute] = useState<Route>({view: 'home', selected: null, archiveId: null});
      const [title, setTitle] = useState('Tarea 1');
      const controller = useHistory({
        history,
        subscribePopState(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        readRoute: () => route,
        applyRoute: setRoute,
        guardNavigation: () => 'allow',
        setTitle(next) { document.title = next.view === 'home' ? 'Inicio · Turno' : `${title} · Turno`; },
      });
      return <><button onClick={() => controller.push({view: 'workspace', selected: {kind: 'task', id: 'task-1'}, archiveId: null})}>Abrir</button><button onClick={() => setTitle('Título editado')}>Editar título</button><output>{route.view}</output></>;
    }
    for (let cycle = 0; cycle < 20; cycle++) {
      const view = render(<StrictMode><Harness /></StrictMode>);
      expect(listeners.size).toBe(1);
      expect(replaces).toBe(cycle + 1);
      fireEvent.click(screen.getByRole('button', {name: 'Abrir'}));
      expect(pushes).toBe(cycle + 1);
      expect(screen.getByRole('status')).toHaveTextContent('workspace');
      expect(document.title).toBe('Tarea 1 · Turno');
      fireEvent.click(screen.getByRole('button', {name: 'Editar título'}));
      expect(document.title).toBe('Título editado · Turno');
      expect(pushes).toBe(cycle + 1);
      view.unmount(); expect(listeners.size).toBe(0);
    }
  });
});
