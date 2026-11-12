/**
 * R5c: detección determinista de tareas duplicadas por palabras de contenido.
 * Regla: una tarea abierta está cubierta si todas sus palabras de contenido aparecen en el título propuesto.
 * Sin modelo, sin red. Las palabras vacías (artículos, preposiciones) se ignoran y las formas
 * verbales o de plural frecuentes se reducen a una raíz simple (ordena/ordenar -> "orden").
 */

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'al', 'para', 'por',
  'con', 'que', 'se', 'lo', 'le', 'les', 'su', 'sus', 'mi', 'mis',
]);
// Las letras sueltas (a, e, o, u, y) NO son vacías: pueden ser rótulos ("pasillo A" ≠ "pasillo B").
// Conservarlas solo puede dejar pasar una propuesta, nunca ocultar una tarea distinta.

/** Una tarea abierta necesita al menos estas palabras de contenido para bloquear: "Llamar" sola no oculta "Llamar al médico". */
export const MIN_TASK_WORDS = 2;

const MIN_STEM = 2;

function stemWord(word) {
  if (word.length <= 3) return word;
  let w = word;
  if (w.endsWith('es')) w = w.slice(0, -2);
  else if (w.endsWith('s')) w = w.slice(0, -1);
  if (/(ar|er|ir)$/.test(w) && w.length - 2 >= MIN_STEM) return w.slice(0, -2);
  if (/[aeo]$/.test(w) && w.length - 1 >= MIN_STEM) return w.slice(0, -1);
  return w;
}

/** Palabras de contenido normalizadas (NFC, minúsculas, sin tildes, sin vacías, raíz simple), sin repetir. */
export function contentWords(text) {
  if (typeof text !== 'string') return [];
  const normalized = text.normalize('NFC').toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '');
  const seen = new Set();
  for (const raw of normalized.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    seen.add(stemWord(raw));
  }
  return [...seen];
}

/** true si alguna tarea abierta con palabras de contenido tiene todas esas palabras en el título. Nunca lanza. */
export function isCoveredByOpenTask(title, tasks) {
  try {
    if (typeof title !== 'string' || !Array.isArray(tasks)) return false;
    const titleWords = new Set(contentWords(title));
    return tasks.some(t => {
      if (!t || t.completed || typeof t.title !== 'string') return false;
      const words = contentWords(t.title);
      return words.length >= MIN_TASK_WORDS && words.every(w => titleWords.has(w));
    });
  } catch {
    return false;
  }
}
