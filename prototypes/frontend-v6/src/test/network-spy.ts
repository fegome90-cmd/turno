// Espías de red y almacenamiento para pruebas de store/adaptador (2A): cualquier llamada cuenta.
import {vi} from 'vitest';

const names = ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB'] as const;

export function installNetworkAndStorageSpies() {
  const storage = () => ({getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn()});
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('XMLHttpRequest', vi.fn());
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('indexedDB', {open: vi.fn(), deleteDatabase: vi.fn()});
  return {
    // Número de llamadas a cualquier espía: debe ser 0 en la demo.
    calls(): number {
      let total = 0;
      for (const name of names) {
        const value = (globalThis as Record<string, unknown>)[name] as Record<string, unknown> | ((...args: unknown[]) => unknown);
        if (typeof value === 'function' && 'mock' in value) total += (value as unknown as {mock: {calls: unknown[]}}).mock.calls.length;
        else if (value && typeof value === 'object') {
          for (const member of Object.values(value)) {
            if (typeof member === 'function' && 'mock' in member) total += (member as unknown as {mock: {calls: unknown[]}}).mock.calls.length;
          }
        }
      }
      return total;
    },
  };
}
