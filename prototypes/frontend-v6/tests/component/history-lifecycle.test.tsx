import {StrictMode, useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {useHistory} from '../../src/navigation/use-history';
import type {HistoryPort} from '../../src/navigation/history-controller';
import type {Route} from '../../src/domain/types';

describe('G2B · hook effect lifecycle', () => {
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
