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

import { titleHasKeywords } from '../eval/run-note-eval.mjs';
import { NOTE_OUTPUT_TOKENS, NOTE_TOTAL_TOKENS } from '../note-proposal.mjs';

test('evaluador por raíz: «Actualiza» cuenta como «actualizar»; falta de palabra o título vacío fallan', () => {
  assert.equal(titleHasKeywords('Actualiza la pizarra de turnos de la semana', ['actualizar', 'pizarra']), true);
  assert.equal(titleHasKeywords('Coloca el letrero de piso resbaladizo', ['letrero']), true);
  assert.equal(titleHasKeywords('Reponer guantes', ['reponer', 'pizarra']), false);
  assert.equal(titleHasKeywords('', ['pizarra']), false);
  assert.equal(titleHasKeywords(null, ['pizarra']), false);
});

test('extractor: presupuesto de salida 1200 tokens (600 cortaba 3 de 26 en vivo)', () => {
  assert.equal(NOTE_OUTPUT_TOKENS, 1200);
  assert.ok(NOTE_TOTAL_TOKENS >= NOTE_OUTPUT_TOKENS + 1000);
});

import { NOTE_PROBE } from '../eval/note-probe.mjs';
test('sondeo: 6 condicionales que deben abstenerse, textos únicos frente a los 50', () => {
  assert.equal(NOTE_PROBE.length, 6);
  for (const c of NOTE_PROBE) assert.equal(c.expect, 'abstain');
  const all = [...NOTE_CORPUS, ...NOTE_HOLDOUT, ...NOTE_EXTENDED, ...NOTE_PROBE];
  assert.equal(new Set(all.map(c => c.text)).size, 56);
  assert.equal(new Set(all.map(c => c.id)).size, 56);
});
