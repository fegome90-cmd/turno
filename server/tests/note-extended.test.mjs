import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_EXTENDED, EXTENDED_GROUP_COUNTS } from '../eval/note-extended.mjs';
import { NOTE_CORPUS, NOTE_HOLDOUT, NOTE_TEXT_MAX } from '../eval/note-corpus.mjs';

test('extendido: 28 casos con la distribución declarada', () => {
  assert.equal(NOTE_EXTENDED.length, 28);
  const counts = {};
  for (const c of NOTE_EXTENDED) counts[c.group] = (counts[c.group] ?? 0) + 1;
  assert.deepEqual(counts, { ...EXTENDED_GROUP_COUNTS });
});

test('extendido: ids y textos únicos frente a los 50 casos', () => {
  const all = [...NOTE_CORPUS, ...NOTE_HOLDOUT, ...NOTE_EXTENDED];
  assert.equal(all.length, 50);
  assert.equal(new Set(all.map(c => c.id)).size, 50);
  assert.equal(new Set(all.map(c => c.text)).size, 50);
  for (const c of NOTE_EXTENDED) assert.ok(c.text.length >= 1 && c.text.length <= NOTE_TEXT_MAX && c.text === c.text.trim(), c.id);
});

test('extendido: las palabras clave de cada tarea están en su título de referencia', () => {
  for (const c of NOTE_EXTENDED.filter(c => c.expect === 'proposed')) {
    const t = c.expectedTitle.toLocaleLowerCase('es');
    for (const w of c.expectTitleIncludes) assert.ok(t.includes(w), `${c.id}: ${w}`);
  }
});
