import {chooseHomeSubtitle} from '../domain/home-subtitle';

export type HomeSession = {preferredName: string; homeSubtitle: string};

// Se llama una vez por carga de página, fuera del árbol de React, para que StrictMode no vuelva a sortear.
export function createSession({
  random = Math.random,
  preferredName = 'Demo',
}: {random?: () => number; preferredName?: string} = {}): HomeSession {
  return {preferredName, homeSubtitle: chooseHomeSubtitle(random)};
}
