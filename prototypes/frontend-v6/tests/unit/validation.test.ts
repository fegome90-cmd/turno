// Portado de v5 tests/validation.test.mjs (VALIDATION-01..02) con casos añadidos por el plan 2A y el WARN de 1B (trim).
import {describe, expect, it} from 'vitest';
import {validateEditor, validateTemporal} from '../../src/domain/validation';
import {applyTemporalDraft, createTemporalDraft} from '../../src/domain/draft-state';
import type {TemporalDraft} from '../../src/domain/types';
import {makeTask} from '../../src/test/fixtures';

const draft = makeTask({title: 'Tarea', body: ''});
const temporal: TemporalDraft = {date: '07/11/2026', time: '', estimate: '', performed: '', duration: ''};

describe('validación de editor', () => {
  it('VALIDATION-01 · validation distinguishes fields in the same semantic family', () => {
    const errors = validateEditor(draft, {...temporal, time: '25:00', performed: '30:00', estimate: '-1', duration: '1441'});
    expect(Object.keys(errors)).toEqual(['time', 'estimate', 'performed', 'duration']);
    for (const [id, label] of [
      ['time', 'Hora prevista'],
      ['estimate', 'Estimación'],
      ['performed', 'Hora realizada'],
      ['duration', 'Duración registrada'],
    ] as const) {
      expect(errors[id]?.startsWith(label)).toBe(true);
    }
  });

  it('VALIDATION-01 · añadido: minutos vacío, 0 y 1440 válidos; -1, 1.5 y 1441 inválidos con el mensaje de v5', () => {
    for (const value of ['', '0', '1440']) {
      expect(validateEditor(draft, {...temporal, estimate: value})).toEqual({});
    }
    for (const value of ['-1', '1.5', '1441']) {
      expect(validateEditor(draft, {...temporal, estimate: value}).estimate).toBe(
        'Estimación: usa minutos enteros entre 0 y 1440.',
      );
    }
  });

  it('VALIDATION-01 · añadido: 23:59 válido y 24:00 inválido con el mensaje de v5', () => {
    expect(validateEditor(draft, {...temporal, time: '23:59'})).toEqual({});
    expect(validateEditor(draft, {...temporal, time: '24:00'}).time).toBe(
      'Hora prevista: usa una hora de 24 horas, por ejemplo 14:30.',
    );
  });

  it('VALIDATION-01 · añadido (WARN 1B): el texto crudo de minutos se valida sin trim, y su espacio no cambia el valor aplicado', () => {
    // Si una mutación elimina el trim() de la validación, «  10  » daría error: esta prueba lo detecta.
    expect(validateEditor(draft, {...temporal, estimate: '  10  '})).toEqual({});
    expect(validateEditor(draft, {...temporal, estimate: '   '})).toEqual({});
    const raw = {...temporal, estimate: '  10  '};
    const applied = applyTemporalDraft(draft, raw);
    expect(applied.estimate).toBe('10');
    expect(raw.estimate).toBe('  10  ');
  });

  it('VALIDATION-02 · civil date validation, date dependency, valid boundaries and note isolation', () => {
    expect(validateEditor(draft, {...temporal, date: '31/02/2026'}).date).toBeTruthy();
    expect(validateEditor(draft, {...temporal, date: '', time: '14:30'}).date).toBeTruthy();
    expect(
      validateEditor(draft, {...temporal, date: '29/02/2024', time: '23:59', performed: '00:00', estimate: '0', duration: '1440'}),
    ).toEqual({});
    const note = {id: 'note-1', title: 'Nota', body: '', version: 1};
    expect(validateEditor(note, null, true)).toEqual({});
    expect(validateEditor({...note, title: '   '}, null, true).title).toBeTruthy();
  });

  it('VALIDATION-02 · añadido: 29/02/2028 válido, 29/02/2027 inválido y 31/02/2026 conservado como texto crudo con error', () => {
    expect(validateEditor(draft, {...temporal, date: '29/02/2028'})).toEqual({});
    expect(validateEditor(draft, {...temporal, date: '29/02/2027'}).date).toBeTruthy();
    const raw = createTemporalDraft(makeTask({date: null}));
    raw.date = '31/02/2026';
    expect(validateEditor(draft, raw).date).toBeTruthy();
    expect(raw.date).toBe('31/02/2026');
  });

  it('VALIDATION-02 · añadido: título de 1 y 300 caracteres válido; 301 inválido; cuerpo 10.000 válido y 10.001 inválido', () => {
    const note = (title: string, body: string) => ({id: 'n', title, body, version: 1});
    expect(validateEditor(note('x', ''), null, true)).toEqual({});
    expect(validateEditor(note('x'.repeat(300), ''), null, true)).toEqual({});
    expect(validateEditor(note('x'.repeat(301), ''), null, true).title).toBeTruthy();
    expect(validateEditor(note('t', 'y'.repeat(10000)), null, true)).toEqual({});
    expect(validateEditor(note('t', 'y'.repeat(10001)), null, true).body).toBe('Notas: usa como máximo 10.000 caracteres.');
  });

  it('VALIDATION-02 · añadido: validateTemporal expone la regla de minutos y hora de v5', () => {
    expect(validateTemporal('minutes', 'Estimación', '')).toBeNull();
    expect(validateTemporal('minutes', 'Estimación', '1441')).toBe('Estimación: usa minutos enteros entre 0 y 1440.');
    expect(validateTemporal('time', 'Hora prevista', '24:00')).toBe('Hora prevista: usa una hora de 24 horas, por ejemplo 14:30.');
  });
});
