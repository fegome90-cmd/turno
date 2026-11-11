// Frases de v5 (src/home-subtitle.mjs), congeladas. Sin interpolar nombre.
export const HOME_SUBTITLES: readonly string[] = Object.freeze([
  '¿Qué haremos hoy?',
  '¿Por dónde empezamos?',
  '¿Qué tienes en mente?',
  '¿En qué te ayudo hoy?',
]);

// Un solo muestreo por llamada. Valores fuera de rango se acotan; NaN o no finito cae en la primera frase.
export function chooseHomeSubtitle(random: () => number = Math.random): string {
  const sample = Number(random());
  const last = HOME_SUBTITLES.length - 1;
  const index = Number.isFinite(sample)
    ? Math.max(0, Math.min(last, Math.floor(sample * HOME_SUBTITLES.length)))
    : 0;
  return HOME_SUBTITLES[index];
}
