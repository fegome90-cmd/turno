// Portado de v5 tests/preview.test.mjs (PREVIEW-01), tests/polish.test.mjs (POLISH-08..11).
// Casos añadidos por el plan 2A se nombran con el ID de la fila más cercana (ver evidence/2A/PARITY-2A.md).
import {describe, expect, it} from 'vitest';
import {displayDate, groupAgenda, localDate, nextCalendarDate, parseDate} from '../../src/domain/format';
import {makeTask} from '../../src/test/fixtures';

describe('formato de fechas y agenda', () => {
  it('PREVIEW-01 · date-only is dd/mm/yyyy and leap days validated', () => {
    expect(parseDate('07/11/2026')).toBe('2026-11-07');
    expect(displayDate('2026-11-07')).toBe('07/11/2026');
    expect(parseDate('29/02/2024')).toBe('2024-02-29');
    expect(() => parseDate('29/02/2025')).toThrow();
    expect(() => parseDate('31/04/2026')).toThrow();
    expect(parseDate('')).toBeNull();
  });

  it('POLISH-08 · civil date is evaluated in Santiago rather than UTC at midnight boundaries', () => {
    expect(localDate(new Date('2026-11-08T01:30:00Z'))).toBe('2026-11-07');
    expect(localDate(new Date('2026-11-08T03:30:00Z'))).toBe('2026-11-08');
    expect(localDate(new Date('2026-06-08T03:30:00Z'))).toBe('2026-06-07');
    expect(localDate(new Date('2026-06-08T04:30:00Z'))).toBe('2026-06-08');
  });

  it('POLISH-08 · añadido: fin de mes, fin de año y bisiesto se evalúan en Santiago', () => {
    // 31/12 23:30 en Santiago (-03) es 01/01 en UTC: una fecha validada en UTC falla aquí.
    expect(localDate(new Date('2026-12-31T23:30:00-03:00'))).toBe('2026-12-31');
    // Marzo 2026 sigue en horario de verano (-03): 01/03 02:30Z es 28/02 local.
    expect(localDate(new Date('2026-03-01T02:30:00Z'))).toBe('2026-02-28');
    expect(localDate(new Date('2028-02-29T02:30:00Z'))).toBe('2028-02-28');
  });

  it('POLISH-09 · tomorrow calendar arithmetic handles month/year/leap boundaries without 24-hour assumptions', () => {
    expect(nextCalendarDate('2026-12-31')).toBe('2027-01-01');
    expect(nextCalendarDate('2024-02-28')).toBe('2024-02-29');
    expect(nextCalendarDate('2024-02-29')).toBe('2024-03-01');
    expect(nextCalendarDate('2026-09-05')).toBe('2026-09-06');
  });

  it('POLISH-09 · añadido: 28/02 de año no bisiesto pasa a 01/03', () => {
    expect(nextCalendarDate('2026-02-28')).toBe('2026-03-01');
    expect(nextCalendarDate('2028-02-28')).toBe('2028-02-29');
  });

  it('POLISH-10 · agenda groups Hoy, Mañana, later dates and undated tasks without mutating data', () => {
    const tasks = [
      makeTask({id: 'undated', date: null, time: '', completed: false}),
      makeTask({id: 'later', date: '2026-11-10', time: ''}),
      makeTask({id: 'tomorrow', date: '2026-11-08', time: '10:30'}),
      makeTask({id: 'today-late', date: '2026-11-07', time: '', completed: true}),
      makeTask({id: 'today', date: '2026-11-07', time: '09:00'}),
    ];
    const snapshot = structuredClone(tasks);
    const groups = groupAgenda(tasks, new Date('2026-11-08T01:30:00Z'));
    expect(groups.map((group) => group.label)).toEqual(['Hoy', 'Mañana', '10/11/2026', 'Sin fecha']);
    expect(groups[0].tasks.map((task) => task.id)).toEqual(['today', 'today-late']);
    expect(groups[0].tasks[1].completed).toBe(true);
    expect(tasks).toEqual(snapshot);
  });

  it('POLISH-10 · añadido: «Mañana» es el día civil siguiente aunque el cambio de horario de Chile tenga 23 h', () => {
    // 06/09/2026 es el inicio del horario de verano en Chile (04:00Z). A las 03:30Z del 06/09 aún es 05/09 local.
    // Sumar 24 h daría 07/09 (fallo de la mutación «mañana = +24 h»).
    expect(localDate(new Date('2026-09-06T03:30:00Z'))).toBe('2026-09-05');
    expect(localDate(new Date('2026-09-06T04:30:00Z'))).toBe('2026-09-06');
    const groups = groupAgenda(
      [makeTask({id: 'mañana', date: '2026-09-06'}), makeTask({id: 'pasado', date: '2026-09-07'})],
      new Date('2026-09-06T03:30:00Z'),
    );
    expect(groups.map((group) => group.label)).toEqual(['Mañana', '07/09/2026']);
  });

  it('POLISH-11 · agenda handles empty and only-undated lists, including empty date strings', () => {
    expect(groupAgenda([])).toEqual([]);
    const groups = groupAgenda([makeTask({date: null}), makeTask({id: 'empty', date: ''})]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Sin fecha');
    expect(groups[0].tasks).toHaveLength(2);
  });
});
