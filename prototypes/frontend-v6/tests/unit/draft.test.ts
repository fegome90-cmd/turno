// Portado de v5 tests/draft.test.mjs (DRAFT-01..03).
import {describe, expect, it} from 'vitest';
import {applyTemporalDraft, createTemporalDraft} from '../../src/domain/draft-state';
import {makeTask} from '../../src/test/fixtures';

describe('borrador temporal crudo', () => {
  it('DRAFT-01 · raw temporal draft retains edits before validation and across re-render', () => {
    const raw = createTemporalDraft(makeTask({date: '2026-11-07', time: '', estimate: '', performed: '', duration: ''}));
    raw.date = '08/11/2026';
    raw.time = '09:30';
    const fresh = structuredClone(raw);
    expect(fresh.date).toBe('08/11/2026');
    expect(fresh.time).toBe('09:30');
    const task = applyTemporalDraft(makeTask({title: 'Task'}), fresh);
    expect(task.date).toBe('2026-11-08');
    expect(task.time).toBe('09:30');
  });

  it('DRAFT-02 · invalid temporal text survives validation failure', () => {
    const raw = createTemporalDraft(makeTask({date: null, time: '', estimate: '', performed: '', duration: ''}));
    raw.date = '31/02/2026';
    expect(() => applyTemporalDraft(makeTask({date: null}), raw)).toThrow();
    expect(raw.date).toBe('31/02/2026');
  });

  it('DRAFT-03 · applying temporal fields does not mutate source entity', () => {
    const task = makeTask({date: '2026-11-07', time: ''});
    const raw = createTemporalDraft(task);
    raw.time = '11:30';
    applyTemporalDraft(task, raw);
    expect(task.time).toBe('');
  });
});

describe('borrador temporal · cierre de WARN de la revisión 2A', () => {
  it('DRAFT-03 · añadido: applyTemporalDraft recorta las cuatro claves de texto como v5', () => {
    const task = applyTemporalDraft(makeTask({date: '2026-11-07'}), {
      date: '07/11/2026',
      time: ' 09:30 ',
      estimate: '  10  ',
      performed: ' 10:00 ',
      duration: '  5  ',
    });
    expect({time: task.time, estimate: task.estimate, performed: task.performed, duration: task.duration}).toEqual({
      time: '09:30',
      estimate: '10',
      performed: '10:00',
      duration: '5',
    });
  });

  it('DRAFT-03 · añadido: vacío no es cero: estimación y duración vacías se aplican como cadena vacía', () => {
    const raw = {date: '', time: '', estimate: '', performed: '', duration: ''};
    const task = applyTemporalDraft(makeTask({estimate: '20', duration: '30'}), raw);
    expect(task.estimate).toBe('');
    expect(task.duration).toBe('');
    expect(task.date).toBeNull();
  });
});
