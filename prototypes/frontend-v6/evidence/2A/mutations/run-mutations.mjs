// Mutaciones en copia (scratchpad). Cada una debe ser detectada: vitest debe salir con código != 0.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const FE = process.argv[2];
const OUT = process.argv[3];
const mutations = [
  {id: 'M1-fecha-utc', file: 'src/domain/format.ts',
    from: `  const today = localDate(now);\n  const tomorrow`, to: `  const today = now.toISOString().slice(0, 10);\n  const tomorrow`,
    note: 'fecha de Santiago sustituida por UTC en la agenda'},
  {id: 'M1b-localdate-utc', file: 'src/domain/format.ts',
    from: `  }).formatToParts(now);`, to: `  }).formatToParts(new Date(0));`, note: 'localDate ignora la hora dada (variante de zona)'},
  {id: 'M2-manana-24h', file: 'src/domain/format.ts',
    from: `  const tomorrow = nextCalendarDate(today);`, to: `  const tomorrow = localDate(new Date(now.getTime() + 24 * 3600 * 1000));`,
    note: '«mañana» como +24 h'},
  {id: 'M3-conflicto-pisa-borrador', file: 'src/app/store.ts',
    from: `    const persist = null;`, to: '',
    note: 'placeholder (se reemplaza abajo)', skip: true},
  {id: 'M4-fallo-confirma', file: 'src/app/store.ts',
    from: `          () => port.saveTask(payload),`,
    to: `          () => port.saveTask(payload).catch((error) => { patchSnapshot((current) => replaceTask(current, payload)); throw error; }),`,
    note: 'el fallo de saveTask confirma el valor en el snapshot'},
  {id: 'M5-snapshot-compartido', file: 'src/adapters/preview-adapter.ts',
    from: `      await wait();\n      return clone(state);`, to: `      await wait();\n      return state as never;`,
    note: 'load devuelve la referencia interna, sin clonar'},
  {id: 'M6-renombrar-cambia-id', file: 'src/adapters/preview-adapter.ts',
    from: `      bed.label = titled(label);`, to: `      bed.label = titled(label);\n      bed.id = 'bed-' + bed.label.replace(/\\s+/g, '-').toLowerCase();`,
    note: 'renombrar una lista cambia su id'},
  {id: 'M7-nota-con-shiftid', file: 'src/adapters/preview-adapter.ts',
    from: `      state.notes[index] = {id: note.id, title: titled(note.title), body: note.body, version: note.version + 1};`,
    to: `      state.notes[index] = {...note, title: titled(note.title), body: note.body, version: note.version + 1} as never;`,
    note: 'la nota guarda campos ajenos (shiftId)'},
  {id: 'M8-minutos-sin-trim', file: 'src/domain/validation.ts',
    from: `  const value = String(raw ?? '').trim();\n  if (!value) return null;\n  if (kind === 'time')`,
    to: `  const value = String(raw ?? '');\n  if (!value.trim()) return null;\n  if (kind === 'time')`,
    note: 'la validación de minutos no recorta el texto crudo (trim eliminado)'},
  {id: 'M9-suscripcion-no-liberada', file: 'src/app/store.ts',
    from: `      disposed = true;\n      unsubscribe();`, to: `      disposed = true;`,
    note: 'dispose no libera la suscripción al notification-store'},
];
// M3: conflicto que pisa el borrador: en la rama de error de persist, el borrador vuelve al confirmado.
mutations.find((m) => m.id === 'M3-conflicto-pisa-borrador').from = null;
const m3 = {id: 'M3-conflicto-pisa-borrador', file: 'src/app/store.ts',
  from: `      } catch (error) {\n        notify(error);`,
  to: `      } catch (error) {\n        notify(error);\n        const snap = get().snapshot;\n        const sel = get().selection;\n        const t = sel?.kind === 'task' && snap ? snap.tasks.find((x) => x.id === sel.id) : undefined;\n        if (t) set({draft: {id: t.id, kind: 'task', title: t.title, body: t.body}, temporal: createTemporalDraft(t)});`,
  note: 'un error de versión/guardado repone el borrador desde el snapshot'};
const list = mutations.filter((m) => !m.skip && m.from !== null).map((m) => (m.id.startsWith('M3') ? m3 : m));
list.splice(list.findIndex((m) => m.id === 'M4-fallo-confirma') + 0, 0);
// Asegura que M3 aparece una sola vez.
const final = [];
for (const m of list) if (!final.some((x) => x.id === m.id)) final.push(m);
if (!final.some((m) => m.id === 'M3-conflicto-pisa-borrador')) final.push(m3);
// Store: M3 y M4/M9 operan sobre store.ts; restaurar entre ejecuciones.
const results = [];
for (const m of final) {
  const target = path.join(FE, m.file);
  const original = fs.readFileSync(target, 'utf8');
  const count = original.split(m.from).length - 1;
  if (count !== 1) { results.push({id: m.id, status: 'NOT-APPLIED', count}); continue; }
  fs.writeFileSync(target, original.replace(m.from, m.to));
  const run = spawnSync('npx', ['vitest', 'run', '--project', 'unit', '--maxWorkers=1', '--no-file-parallelism', 'format', 'validation', 'draft', 'preview', 'store'], {cwd: FE, encoding: 'utf8', env: process.env});
  fs.writeFileSync(path.join(OUT, `${m.id}.log`), (run.stdout || '') + (run.stderr || ''));
  fs.writeFileSync(target, original);
  const text = (run.stdout || '') + (run.stderr || '');
  const failed = (text.replace(/\x1b\[[0-9;]*m/g, '').match(/Tests\s+(\d+) failed/) || [])[1] || '0';
  results.push({id: m.id, note: m.note, exit: run.status, failedTests: Number(failed), status: run.status !== 0 ? 'DETECTED' : 'SURVIVED'});
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
