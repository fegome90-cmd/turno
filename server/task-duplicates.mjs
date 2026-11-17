/**
 * R5c: detección determinista de tareas duplicadas por palabras de contenido.
 * Regla (P1-02): una tarea abierta está cubierta solo si el título propuesto tiene EXACTAMENTE el mismo
 * conjunto de palabras de contenido que la tarea (mismos miembros, mismo tamaño). Un título con
 * detalle extra («sala 2», «de traslado») no es duplicado: se propone, y la persona decide.
 * Sin modelo, sin red. Las palabras vacías (artículos, preposiciones) se ignoran y las formas
 * verbales o de plural frecuentes se reducen a una raíz simple (ordena/ordenar -> "orden").
 * Limitación conocida: la raíz es heurística y puede colisionar («sala» y «sal»
 * reducen a «sal»). Una colisión puede causar abstención por duplicado pese a
 * que las tareas sean distintas; la tarea abierta permanece visible y la persona
 * puede crear otra manualmente. Nunca se realizan escrituras automáticas.
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

/** true si alguna tarea abierta (no completada, ≥ 2 palabras de contenido) tiene exactamente el mismo conjunto de palabras que el título. Nunca lanza. */
export function isCoveredByOpenTask(title, tasks) {
  try {
    if (typeof title !== 'string' || !Array.isArray(tasks)) return false;
    const titleWords = new Set(contentWords(title));
    return tasks.some(t => {
      if (!t || t.completed || typeof t.title !== 'string') return false;
      const words = contentWords(t.title);
      return words.length >= MIN_TASK_WORDS && words.length === titleWords.size && words.every(w => titleWords.has(w));
    });
  } catch {
    return false;
  }
}
