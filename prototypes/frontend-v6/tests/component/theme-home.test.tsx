import {StrictMode, type ReactNode} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {ThemeProvider, useTheme, type ThemeApi} from '../../src/appearance/theme-provider';
import {Home} from '../../src/components/Home';
import {HOME_SUBTITLES} from '../../src/domain/home-subtitle';

const QUERY = '(prefers-color-scheme: dark)';

type SystemControl = {setSystemDark(value: boolean): void};

// Fake MediaQueryList: the system value and its change listeners are controlled by the test.
function installMatchMedia(initialDark: boolean): SystemControl {
  let dark = initialDark;
  const listeners = new Set<(event: {matches: boolean}) => void>();
  const list = {
    media: QUERY,
    get matches() {
      return dark;
    },
    addEventListener(type: string, fn: (event: {matches: boolean}) => void) {
      if (type === 'change') listeners.add(fn);
    },
    removeEventListener(type: string, fn: (event: {matches: boolean}) => void) {
      if (type === 'change') listeners.delete(fn);
    },
  };
  window.matchMedia = ((query: string) =>
    query === QUERY
      ? list
      : {media: query, matches: false, addEventListener() {}, removeEventListener() {}}) as unknown as typeof window.matchMedia;
  return {
    setSystemDark(value: boolean) {
      dark = value;
      for (const fn of listeners) fn({matches: value});
    },
  };
}

function captureTheme() {
  const ref: {current: ThemeApi | null} = {current: null};
  function Probe() {
    ref.current = useTheme();
    return null;
  }
  const api = () => {
    if (!ref.current) throw new Error('ThemeProvider probe not mounted');
    return ref.current;
  };
  return {Probe, api};
}

function mountTheme() {
  const probe = captureTheme();
  render(
    <ThemeProvider>
      <probe.Probe />
    </ThemeProvider>,
  );
  return probe.api;
}

const html = () => document.documentElement;

beforeEach(() => {
  html().removeAttribute('data-theme');
  html().removeAttribute('data-theme-preference');
});

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DESIGN-COMPLETE-01 · preferencia de tema de sesión', () => {
  it('DESIGN-COMPLETE-01 · la preferencia por defecto es system y sigue el sistema oscuro', () => {
    installMatchMedia(true);
    const api = mountTheme();
    expect(api().preference).toBe('system');
    expect(api().effective).toBe('dark');
    expect(html().dataset.theme).toBe('dark');
    expect(html().dataset.themePreference).toBe('system');
  });

  it('DESIGN-COMPLETE-01 · con preferencia system, un cambio del sistema actualiza el tema', () => {
    const system = installMatchMedia(true);
    const api = mountTheme();
    act(() => system.setSystemDark(false));
    expect(api().effective).toBe('light');
    expect(html().dataset.theme).toBe('light');
  });

  it('DESIGN-COMPLETE-01 · una elección explícita sobrevive a cambios del sistema', () => {
    const system = installMatchMedia(false);
    const api = mountTheme();
    let accepted = false;
    act(() => {
      accepted = api().setPreference('dark');
    });
    expect(accepted).toBe(true);
    act(() => system.setSystemDark(false));
    expect(api().preference).toBe('dark');
    expect(html().dataset.theme).toBe('dark');
    expect(html().dataset.themePreference).toBe('dark');
  });

  it('DESIGN-COMPLETE-01 · un valor inválido se rechaza sin cambiar la preferencia', () => {
    installMatchMedia(false);
    const api = mountTheme();
    act(() => {
      api().setPreference('dark');
    });
    let accepted = true;
    act(() => {
      accepted = api().setPreference('auto' as unknown as 'dark');
    });
    expect(accepted).toBe(false);
    expect(api().preference).toBe('dark');
    expect(html().dataset.theme).toBe('dark');
  });

  it('DESIGN-COMPLETE-01 · volver a system vuelve a seguir al sistema actual', () => {
    const system = installMatchMedia(false);
    const api = mountTheme();
    act(() => {
      api().setPreference('dark');
    });
    act(() => system.setSystemDark(true));
    act(() => {
      api().setPreference('system');
    });
    expect(api().preference).toBe('system');
    expect(html().dataset.theme).toBe('dark');
    act(() => system.setSystemDark(false));
    expect(html().dataset.theme).toBe('light');
  });
});

describe('DESIGN-COMPLETE-02 · sin matchMedia', () => {
  it('DESIGN-COMPLETE-02 · el efectivo es light y un dark explícito funciona', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    const api = mountTheme();
    expect(api().effective).toBe('light');
    expect(html().dataset.theme).toBe('light');
    act(() => {
      api().setPreference('dark');
    });
    expect(api().effective).toBe('dark');
    expect(html().dataset.theme).toBe('dark');
  });
});

describe('TOKENS-01 · tokens solid y on-solid', () => {
  it('TOKENS-01 · --solid y --on-solid en :root y en dark, copiados de v5', () => {
    // Vitest runs from the project root; jsdom's import.meta.url is not a file URL.
    const css = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf8');
    expect(css).toMatch(/:root\{[^}]*--solid:#111[^}]*--on-solid:#fff/);
    expect(css).toMatch(/:root\[data-theme=dark\]\{[^}]*--solid:#f2f3f0[^}]*--on-solid:#171817/);
  });
});

describe('UI-01 · Inicio', () => {
  const summary = {message: 'No hay un turno abierto.', actionLabel: 'Iniciar turno'};

  it('UI-01 · saludo con nombre, una sola acción de resumen y ningún input', () => {
    const onOpenShift = vi.fn();
    const {container} = render(
      <Home preferredName="Demo" subtitle="¿Qué haremos hoy?" summary={summary} onOpenShift={onOpenShift} />,
    );
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(/^Hola, Demo\.$/);
    const main = container.querySelector('main') as HTMLElement;
    const buttons = main.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onOpenShift).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('UI-01 · sin nombre el saludo es Hola.', () => {
    render(<Home preferredName="" subtitle="¿Qué haremos hoy?" summary={summary} onOpenShift={() => {}} />);
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(/^Hola\.$/);
  });

  it('HOME-SUBTITLE-02 · el subtítulo recibido se muestra y cambiar tema no lo cambia', () => {
    const system = installMatchMedia(false);
    const session = createSession({random: () => 0.6, preferredName: 'Demo'});
    expect(HOME_SUBTITLES).toContain(session.homeSubtitle);
    const probe = captureTheme();
    render(
      <AppProviders>
        <probe.Probe />
        <Home preferredName="Demo" subtitle={session.homeSubtitle} summary={summary} onOpenShift={() => {}} />
      </AppProviders>,
    );
    expect(screen.getByText(session.homeSubtitle)).toBeInTheDocument();
    const before = screen.getByRole('heading', {level: 1}).textContent;
    act(() => {
      probe.api().setPreference('dark');
    });
    act(() => system.setSystemDark(true));
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe(before);
    expect(screen.getByText(session.homeSubtitle)).toBeInTheDocument();
  });
});

describe('EXTRA-STRICTMODE-HOME · sorteo una vez por sesión', () => {
  it('EXTRA-STRICTMODE-HOME · bajo StrictMode el subtítulo se sortea una sola vez y se mantiene', () => {
    installMatchMedia(false);
    const random = vi.fn(() => 0.9);
    const session = createSession({random, preferredName: 'Demo'});
    expect(HOME_SUBTITLES).toContain(session.homeSubtitle);
    const summary = {message: 'No hay un turno abierto.', actionLabel: 'Iniciar turno'};
    const tree = (node: ReactNode) => (
      <StrictMode>
        <AppProviders>{node}</AppProviders>
      </StrictMode>
    );
    const view = render(tree(<Home preferredName="Demo" subtitle={session.homeSubtitle} summary={summary} onOpenShift={() => {}} />));
    expect(random).toHaveBeenCalledTimes(1);
    expect(screen.getByText('¿En qué te ayudo hoy?')).toBeInTheDocument();
    view.rerender(tree(<Home preferredName="Demo" subtitle={session.homeSubtitle} summary={summary} onOpenShift={() => {}} />));
    expect(random).toHaveBeenCalledTimes(1);
    expect(screen.getByText('¿En qué te ayudo hoy?')).toBeInTheDocument();
  });
});

describe('EXTRA-THEME-NO-STORAGE · cero storage y cero red al cambiar tema', () => {
  it('EXTRA-THEME-NO-STORAGE · cambiar tema no llama a setItem ni a fetch', () => {
    const system = installMatchMedia(false);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const api = mountTheme();
    act(() => {
      api().setPreference('dark');
    });
    // Positive check first: the change under test must really have happened, or the zero counts below are vacuous.
    expect(html().dataset.theme).toBe('dark');
    act(() => system.setSystemDark(true));
    act(() => {
      api().setPreference('light');
    });
    expect(html().dataset.theme).toBe('light');
    act(() => {
      api().setPreference('system');
    });
    expect(html().dataset.theme).toBe('dark');
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});


describe('4A theme-color follows the effective theme', () => {
  it('updates the existing browser chrome color for explicit and system preferences', () => {
    const system = installMatchMedia(false), meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = '#ffffff'; document.head.append(meta);
    try {
      const api = mountTheme(); act(() => api().setPreference('dark')); expect(meta.content).toBe('#171817');
      act(() => system.setSystemDark(false)); expect(meta.content).toBe('#171817');
      act(() => api().setPreference('system')); expect(meta.content).toBe('#ffffff');
      act(() => system.setSystemDark(true)); expect(meta.content).toBe('#171817');
    } finally {meta.remove();}
  });
});
