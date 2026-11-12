import test from 'node:test';
import assert from 'node:assert/strict';
import { contentWords, isCoveredByOpenTask } from '../task-duplicates.mjs';

const open = title => ({ id: 't', title, completed: false });

test('casos reales que el chequeo exacto no detectó: cubiertos', () => {
  assert.equal(isCoveredByOpenTask('Reponer guantes talla M en la sala 2', [open('Reponer guantes talla M')]), true);
  assert.equal(isCoveredByOpenTask('Ordena la bodega de ropa limpia', [open('Ordenar bodega de ropa limpia')]), true);
});

test('coincidencia exacta, acentos y mayúsculas: cubiertos', () => {
  assert.equal(isCoveredByOpenTask('Reponer guantes talla M', [open('Reponer guantes talla M')]), true);
  assert.equal(isCoveredByOpenTask('Revisar stock de JERINGAS', [open('revisar stock de jeringás')]), true);
  assert.equal(isCoveredByOpenTask('Reponer guantes talla M', [open('  reponer   GUANTES talla m ')]), true);
});

test('palabras que cambian el significado: no cubiertos', () => {
  assert.equal(isCoveredByOpenTask('Reponer guantes talla L', [open('Reponer guantes talla M')]), false);
  assert.equal(isCoveredByOpenTask('Reponer alcohol gel', [open('Reponer guantes talla M')]), false);
});

test('tarea completada no cubre', () => {
  assert.equal(isCoveredByOpenTask('Reponer guantes talla M', [{ id: 't', title: 'Reponer guantes talla M', completed: true }]), false);
});

test('tarea solo con palabras vacías no cubre', () => {
  assert.equal(contentWords('de la en el').length, 0);
  assert.equal(isCoveredByOpenTask('Cualquier cosa', [open('de la en')]), false);
  assert.equal(isCoveredByOpenTask('de la en el', [open('de la en el')]), false);
});

test('entradas no válidas: false, sin lanzar', () => {
  assert.equal(isCoveredByOpenTask('Reponer guantes', null), false);
  assert.equal(isCoveredByOpenTask('Reponer guantes', undefined), false);
  assert.equal(isCoveredByOpenTask('Reponer guantes', 'Reponer guantes'), false);
  assert.equal(isCoveredByOpenTask('Reponer guantes', [null, undefined, 3, 'x', {}, { title: 7, completed: false }]), false);
  assert.equal(isCoveredByOpenTask(42, [open('Reponer guantes')]), false);
  assert.equal(isCoveredByOpenTask(undefined, [open('Reponer guantes')]), false);
  assert.equal(isCoveredByOpenTask(null, [open('Reponer guantes')]), false);
  assert.equal(isCoveredByOpenTask('', [open('Reponer guantes')]), false);
});

test('contentWords: normaliza, quita vacías y reduce formas verbales y de plural', () => {
  assert.deepEqual(contentWords('Ordena la bodega'), contentWords('ordenar bodega'));
  assert.ok(contentWords('Reponer guantes').includes('repon'));
  assert.ok(contentWords('Reponer guantes').includes('guant'));
  assert.deepEqual(contentWords(undefined), []);
  assert.deepEqual(contentWords('a'), ['a'], 'las letras sueltas se conservan como rótulos');
  assert.deepEqual(contentWords('de la'), []);
});

test('R5c tester: rótulos de una letra distinguen tareas', () => {
  assert.equal(isCoveredByOpenTask('Reponer gel pasillo B', [{ title: 'Reponer gel pasillo A', completed: false }]), false);
  assert.equal(isCoveredByOpenTask('Sacar muestra B', [{ title: 'Sacar muestra A', completed: false }]), false);
  assert.equal(isCoveredByOpenTask('Reponer gel pasillo A', [{ title: 'Reponer gel pasillo A', completed: false }]), true);
});

test('R5c tester: una tarea abierta de una sola palabra de contenido no bloquea', () => {
  assert.equal(isCoveredByOpenTask('Llamar al médico de turno', [{ title: 'Llamar', completed: false }]), false);
  assert.equal(isCoveredByOpenTask('Revisar el carro de paro', [{ title: 'Revisar', completed: false }]), false);
  assert.equal(isCoveredByOpenTask('Limpiar sala 2 y sala 3', [{ title: 'Sala 2', completed: false }]), true, 'dos palabras (sala, 2) sí bloquean');
});
