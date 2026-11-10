// Original wording / our Spanish adaptations, not official Spanish product quotes.
export const HOME_SUBTITLES = Object.freeze([
  '¿Qué haremos hoy?',
  '¿Por dónde empezamos?',
  '¿Qué tienes en mente?',
  '¿En qué te ayudo hoy?',
]);

export function chooseHomeSubtitle(random = Math.random) {
  const sample = Number(random());
  const index = Number.isFinite(sample)
    ? Math.max(0, Math.min(HOME_SUBTITLES.length - 1, Math.floor(sample * HOME_SUBTITLES.length)))
    : 0;
  return HOME_SUBTITLES[index];
}
