// Sesión de arranque (1A/1B/2A). Se crea una vez por bootstrap, fuera del árbol de React (StrictMode no la repite).
import {createPreviewAdapter} from '../adapters/preview-adapter';
import type {PreviewPort} from '../adapters/turno-port';
import {chooseHomeSubtitle} from '../domain/home-subtitle';
import {createNotificationStore, type NotificationStore} from '../notifications/notification-store';
import {createTurnoStore, type TurnoStore} from './store';

export type HomeSession = {preferredName: string; homeSubtitle: string};

export type AppSession = HomeSession & {port: PreviewPort; store: TurnoStore; dispose(): void};

export type CreateSessionOptions = {
  random?: () => number;
  preferredName?: string;
  port?: PreviewPort;
  notifications?: NotificationStore;
};

// `random` se llama una sola vez. `dispose` libera la suscripción del store al notification-store.
export function createSession({
  random = Math.random,
  preferredName = 'Demo',
  port,
  notifications,
}: CreateSessionOptions = {}): AppSession {
  const homeSubtitle = chooseHomeSubtitle(random);
  const adapter = port ?? createPreviewAdapter({preferredName});
  const store = createTurnoStore(adapter, notifications ?? createNotificationStore());
  return {
    preferredName,
    homeSubtitle,
    port: adapter,
    store,
    dispose: () => store.dispose(),
  };
}
