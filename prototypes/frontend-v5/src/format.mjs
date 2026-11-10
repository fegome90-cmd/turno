export const ZONE = 'America/Santiago';
export function parseDate(value) {
  if (!value.trim()) return null;
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if(!m) throw new Error('Usa una fecha válida: DD/MM/AAAA.');
  const [,d,mo,y]=m; const dt=new Date(`${y}-${mo}-${d}T12:00:00Z`);
  if(!Number(y)||!Number(mo)||!Number(d)||Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==`${y}-${mo}-${d}`) throw new Error('La fecha no existe. Usa DD/MM/AAAA.');
  return `${y}-${mo}-${d}`;
}
export function displayDate(value){return value ? value.split('-').reverse().join('/') : 'Sin fecha';}
export function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function nextCalendarDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  // Calendar arithmetic only. Task date-only strings are never parsed as instants.
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day + 1);
  return result.toISOString().slice(0, 10);
}

export function groupAgenda(items, now = new Date()) {
  const today = localDate(now), tomorrow = nextCalendarDate(today);
  const sorted = [...items].sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') ||
    (a.time || '99').localeCompare(b.time || '99')
  );
  const groups = [];
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
