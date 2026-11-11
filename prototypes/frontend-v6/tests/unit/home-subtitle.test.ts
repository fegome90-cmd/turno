import {describe, expect, it} from 'vitest';
import {HOME_SUBTITLES, chooseHomeSubtitle} from '../../src/domain/home-subtitle';

describe('subtítulo de Inicio', () => {
  it('HOME-SUBTITLE-01 · catálogo congelado de cuatro frases exactas sin «Demo» ni «<»', () => {
    expect([...HOME_SUBTITLES]).toEqual([
      '¿Qué haremos hoy?',
      '¿Por dónde empezamos?',
      '¿Qué tienes en mente?',
      '¿En qué te ayudo hoy?',
    ]);
    expect(Object.isFrozen(HOME_SUBTITLES)).toBe(true);
    for (const text of HOME_SUBTITLES) {
      expect(text).not.toContain('Demo');
      expect(text).not.toContain('<');
    }
  });

  it('HOME-SUBTITLE-02 · random inyectado llega a cada frase con (i+.5)/4 y se llama una sola vez', () => {
    expect(HOME_SUBTITLES).toHaveLength(4);
    for (let index = 0; index < HOME_SUBTITLES.length; index++) {
      let calls = 0;
      const result = chooseHomeSubtitle(() => {
        calls++;
        return (index + 0.5) / HOME_SUBTITLES.length;
      });
      expect(result).toBe(HOME_SUBTITLES[index]);
      expect(calls).toBe(1);
    }
  });

  it('HOME-SUBTITLE-03 · -1 da la primera, 1 la última, NaN la primera; nunca undefined', () => {
    expect(chooseHomeSubtitle(() => -1)).toBe(HOME_SUBTITLES[0]);
    expect(chooseHomeSubtitle(() => 1)).toBe(HOME_SUBTITLES[HOME_SUBTITLES.length - 1]);
    expect(chooseHomeSubtitle(() => Number.NaN)).toBe(HOME_SUBTITLES[0]);
    for (const sample of [-1, 0, 0.999, 1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(chooseHomeSubtitle(() => sample)).not.toBeUndefined();
    }
  });
});
