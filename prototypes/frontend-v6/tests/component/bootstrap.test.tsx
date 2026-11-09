import {act} from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {startApp} from '../../src/app/bootstrap';

// Sonda de efectos: ThemeProvider registra un listener de matchMedia en useEffect y lo retira al limpiar.
// Con StrictMode, en desarrollo, el montaje inicial ejecuta add → remove → add; sin StrictMode, add una vez.
function installMatchMediaProbe() {
  const counts = {adds: 0, removes: 0};
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: false,
    addEventListener(type: string) {
      if (type === 'change') counts.adds += 1;
    },
    removeEventListener(type: string) {
      if (type === 'change') counts.removes += 1;
    },
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;
  return counts;
}

let mounted: HTMLElement[] = [];
function newRoot(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  mounted.push(el);
  return el;
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
});

afterEach(() => {
  for (const el of mounted) el.remove();
  mounted = [];
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

describe('EXTRA-STRICTMODE-HOME · arranque real (startApp)', () => {
  it('EXTRA-STRICTMODE-HOME · random se llama exactamente 1 vez y no se usa Math.random', () => {
    installMatchMediaProbe();
    const random = vi.fn(() => 0.9);
    const mathRandom = vi.spyOn(Math, 'random');
    const root = newRoot();
    let stop: () => void = () => {};
    act(() => {
      stop = startApp(root, {random});
    });
    expect(random).toHaveBeenCalledTimes(1);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(root.textContent).toContain('¿En qué te ayudo hoy?');
    act(() => stop());
  });

  it('EXTRA-STRICTMODE-HOME · StrictMode activo: los efectos de ThemeProvider se ejecutan dos veces al montar', () => {
    const counts = installMatchMediaProbe();
    const root = newRoot();
    let stop: () => void = () => {};
    act(() => {
      stop = startApp(root, {random: () => 0});
    });
    // Positivo antes de cero: el montaje real debe haber registrado el listener.
    expect(counts.adds).toBeGreaterThan(0);
    expect(counts.adds).toBe(2);
    expect(counts.removes).toBe(1);
    act(() => stop());
  });

  it('EXTRA-STRICTMODE-HOME · desmontar y montar otra vez crea una sesión nueva', () => {
    installMatchMediaProbe();
    const random = vi.fn(() => 0.1);
    const first = newRoot();
    let stop: () => void = () => {};
    act(() => {
      stop = startApp(first, {random});
    });
    expect(random).toHaveBeenCalledTimes(1);
    act(() => stop());
    const second = newRoot();
    act(() => {
      stop = startApp(second, {random});
    });
    expect(random).toHaveBeenCalledTimes(2);
    expect(second.textContent).toContain('¿Qué haremos hoy?');
    act(() => stop());
  });
});

describe('EXTRA-OFFLINE-FIRST-PAINT-SCRIPT · script inline de tema en preview.html', () => {
  it('EXTRA-OFFLINE-FIRST-PAINT-SCRIPT · preview.html contiene un script inline de tema antes del módulo', () => {
    // Vitest corre desde la raíz del proyecto; se lee el HTML fuente, no el build.
    const html = fs.readFileSync(path.resolve('preview.html'), 'utf8');
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(inline).not.toBeNull();
    expect(inline?.[1]).toContain("matchMedia('(prefers-color-scheme: dark)')");
    expect(inline?.[1]).toContain('root.dataset.theme');
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'));
  });
});
