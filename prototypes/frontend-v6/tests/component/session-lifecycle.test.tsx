// 2A · EXTRA-LIFECYCLE-ASYNC sobre el arranque real: 20 ciclos de montaje/desmontaje con StrictMode.
import {act} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {startApp} from '../../src/app/bootstrap';

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('EXTRA-LIFECYCLE-ASYNC · arranque repetido', () => {
  it('EXTRA-LIFECYCLE-ASYNC · 20 ciclos de montaje y desmontaje: sin nodos residuales y listeners de tema balanceados', () => {
    let adds = 0;
    let removes = 0;
    window.matchMedia = ((query: string) => ({
      media: query,
      matches: false,
      addEventListener(type: string) {
        if (type === 'change') adds += 1;
      },
      removeEventListener(type: string) {
        if (type === 'change') removes += 1;
      },
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    })) as unknown as typeof window.matchMedia;

    for (let cycle = 0; cycle < 20; cycle++) {
      const container = document.createElement('div');
      document.body.append(container);
      let stop: () => void = () => {};
      act(() => {
        stop = startApp(container, {random: () => 0});
      });
      expect(container.textContent).toContain('¿Qué haremos hoy?');
      act(() => stop());
      expect(container.childNodes.length).toBe(0);
      container.remove();
    }
    expect(adds).toBeGreaterThan(0);
    expect(removes).toBe(adds);
  });
});
