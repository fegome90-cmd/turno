// Portado de v5 src/format.mjs. Fechas civiles ISO en el dominio; nunca se convierten en instantes.
import type {AgendaGroup, Task} from './types';

export const ZONE = 'America/Santiago';

// Devuelve null si está vacío; lanza un error con el texto de v5 si el formato o la fecha no existen.
export function parseDate(value: string): string | null {
  if (!value.trim()) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error('Usa una fecha válida: DD/MM/AAAA.');
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (
    !Number(year) ||
    !Number(month) ||
    !Number(day) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  ) {
    throw new Error('La fecha no existe. Usa DD/MM/AAAA.');
  }
  return `${year}-${month}-${day}`;
}

export function displayDate(value: string | null): string {
  return value ? value.split('-').reverse().join('/') : 'Sin fecha';
}

// Fecha civil de Santiago (America/Santiago), no UTC.
export function localDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Aritmética de calendario sobre la cadena de fecha; no suma 24 h.
export function nextCalendarDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day + 1);
  return result.toISOString().slice(0, 10);
}

export function groupAgenda(items: Task[], now: Date = new Date()): AgendaGroup[] {
  const today = localDate(now);
  const tomorrow = nextCalendarDate(today);
  const sorted = [...items].sort(
    (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99'),
  );
  const groups: AgendaGroup[] = [];
  for (const task of sorted) {
    const date = task.date || null;
    let group = groups.at(-1);
    if (!group || group.date !== date) {
      const label = !date ? 'Sin fecha' : date === today ? 'Hoy' : date === tomorrow ? 'Mañana' : displayDate(date);
      group = {date, label, tasks: []};
      groups.push(group);
    }
    group.tasks.push(task);
  }
  return groups;
}
