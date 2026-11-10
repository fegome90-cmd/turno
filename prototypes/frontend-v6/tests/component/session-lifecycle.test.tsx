// 2A · EXTRA-LIFECYCLE-ASYNC sobre el arranque real: 20 ciclos de montaje/desmontaje con StrictMode.
// Cierre de WARN 2A (W5): además de los listeners de matchMedia, cuenta las suscripciones del notification-store
// que crea createSession dentro del arranque real; startApp debe liberarlas al desmontar.
import {act} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {startApp} from '../../src/app/bootstrap';

const subscriptions = vi.hoisted(() => ({active: 0, total: 0}));

vi.mock('../../src/notifications/notification-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/notifications/notification-store')>();
  return {
    ...actual,
    createNotificationStore: () => {
      const base = actual.createNotificationStore();
      return {
        ...base,
        subscribe(listener: () => void) {
          subscriptions.active += 1;
          subscriptions.total += 1;
          const unsubscribe = base.subscribe(listener);
          let done = false;
          return () => {
            if (done) return;
            done = true;
            subscriptions.active -= 1;
            unsubscribe();
          };
        },
      };
    },
  };
});

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

  it('EXTRA-LIFECYCLE-ASYNC · 20 ciclos del arranque real: store y pila tienen tres suscripciones vivas y el desmontaje libera todas', () => {
    const startTotal = subscriptions.total;
    for (let cycle = 0; cycle < 20; cycle++) {
      const container = document.createElement('div');
      document.body.append(container);
      let stop: () => void = () => {};
      act(() => {
        stop = startApp(container, {random: () => 0});
      });
      // Store count mirror + stack render + live announcements. StrictMode
      // replays UI effects, but only these three owners may remain mounted.
      expect(subscriptions.active).toBe(3);
      act(() => stop());
      expect(subscriptions.active).toBe(0);
      container.remove();
    }
    // Each cycle creates one store subscription and two stack subscriptions,
    // with the latter mounted twice by StrictMode (1 + 2 × 2).
    expect(subscriptions.total - startTotal).toBe(20 * 5);
  });
});
