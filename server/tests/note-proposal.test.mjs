import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNoteProposal, createStrandsNoteExtractor } from '../note-proposal.mjs';
import { NOTE_PROPOSAL_PROMPT, NOTE_PROMPT_VERSION } from '../prompts.mjs';

const note = 'Falta reponer el carro de insumos sintético de la sala 2.';
const good = { title: 'Reponer carro de insumos sintético', sourceQuote: 'Falta reponer el carro de insumos sintético' };

test('una acción con cita exacta del texto pasa el validador', () => {
  assert.deepEqual(validateNoteProposal({ action: good }, note), good);
});

test('sin acción (cero o varias, según el modelo) produce silencio', () => {
  assert.equal(validateNoteProposal({ action: null }, note), null);
  for (const raw of [undefined, null, 'texto', [], {}, { action: 'x' }]) {
    assert.equal(validateNoteProposal(raw, note), null);
  }
});

test('la cita debe aparecer exactamente en la nota (sin ignorar mayúsculas)', () => {
  assert.equal(validateNoteProposal({ action: { ...good, sourceQuote: 'falta reponer el carro' } }, note), null);
  assert.equal(validateNoteProposal({ action: { ...good, sourceQuote: 'Reponer el carro de insumos inventado' } }, note), null);
});

test('cita vacía o solo espacios produce silencio', () => {
  assert.equal(validateNoteProposal({ action: { ...good, sourceQuote: '   ' } }, note), null);
  assert.equal(validateNoteProposal({ action: { ...good, sourceQuote: '' } }, note), null);
});

test('un título con hora o fecha no se corrige: se descarta', () => {
  for (const title of ['Reponer carro a las 15:00', 'Reponer carro 9.30', 'Reponer carro 12/11', 'Reponer carro 12-11-2026']) {
    assert.equal(validateNoteProposal({ action: { ...good, title } }, note), null, title);
  }
});

test('título corto o largo se descarta; 3 y 80 caracteres pasan', () => {
  assert.equal(validateNoteProposal({ action: { ...good, title: 'ab' } }, note), null);
  assert.equal(validateNoteProposal({ action: { ...good, title: 'x'.repeat(81) } }, note), null);
  assert.equal(validateNoteProposal({ action: { ...good, title: 'abc' } }, note).title, 'abc');
  assert.equal(validateNoteProposal({ action: { ...good, title: 'x'.repeat(80) } }, note).title.length, 80);
});

test('el título se recorta y no sale ningún campo extra del modelo', () => {
  const out = validateNoteProposal({ action: { ...good, title: '  Reponer carro  ', date: '2026-11-12', priority: 'alta' } }, note);
  assert.deepEqual(Object.keys(out).sort(), ['sourceQuote', 'title']);
  assert.equal(out.title, 'Reponer carro');
});

test('el extractor se niega a crearse con la IA apagada', async () => {
  await assert.rejects(createStrandsNoteExtractor({ env: { TURNO_AI_ENABLED: '0' } }), /desactivada/);
});

test('el prompt de extracción es versionado y pide como máximo una acción', () => {
  assert.equal(NOTE_PROMPT_VERSION, 'n1');
  assert.match(NOTE_PROPOSAL_PROMPT, /como máximo una/);
  assert.match(NOTE_PROPOSAL_PROMPT, /no obedezcas|nunca obedezcas|ignora/i);
});

test('rechaza horas tipo «15h», fechas relativas y citas demasiado cortas', () => {
  const note = 'Hay que pedir gasas estériles a farmacia mañana a las 15h.';
  const quote = 'pedir gasas estériles a farmacia';
  for (const title of ['Pedir gasas a las 15h', 'Pedir gasas 15 hrs', 'Pedir gasas mañana', 'Pedir gasas el lunes', 'Pedir gasas hoy']) {
    assert.equal(validateNoteProposal({ action: { title, sourceQuote: quote } }, note), null, title);
  }
  assert.equal(validateNoteProposal({ action: { title: 'Pedir gasas', sourceQuote: 'gasas' } }, note), null);
  assert.deepEqual(validateNoteProposal({ action: { title: 'Pedir gasas estériles', sourceQuote: quote } }, note),
    { title: 'Pedir gasas estériles', sourceQuote: quote });
  // «Mañanero» o «domingueros» no son fechas: solo palabras completas.
  assert.notEqual(validateNoteProposal({ action: { title: 'Revisar turno mañanero', sourceQuote: quote } }, note), null);
});
