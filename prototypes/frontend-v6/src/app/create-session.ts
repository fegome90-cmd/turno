// Sesión de arranque (1A/1B/2A). Se crea una vez por bootstrap, fuera del árbol de React (StrictMode no la repite).
import {createPreviewAdapter} from '../adapters/preview-adapter';
import type {PreviewPort} from '../adapters/turno-port';
import {chooseHomeSubtitle} from '../domain/home-subtitle';
import type {NoteProposalSource} from '../adapters/note-proposals';
import {createNotificationStore, type NotificationStore} from '../notifications/notification-store';
import {createTurnoStore, type TurnoStore} from './store';

export type HomeSession = {preferredName: string; homeSubtitle: string};

export type AppSession = HomeSession & {port: PreviewPort; store: TurnoStore; notifications: NotificationStore; noteProposals?: NoteProposalSource; dispose(): void};

export type CreateSessionOptions = {
  random?: () => number;
  preferredName?: string;
  port?: PreviewPort;
  notifications?: NotificationStore;
  // Sin origen (demo/preview): guardar una nota no llama a nada y no muestra propuestas.
  noteProposals?: NoteProposalSource;
};

// `random` se llama una sola vez. `dispose` libera la suscripción del store al notification-store.
export function createSession({
  random = Math.random,
  preferredName = 'Demo',
  port,
  notifications,
  noteProposals,
}: CreateSessionOptions = {}): AppSession {
  const homeSubtitle = chooseHomeSubtitle(random);
  const adapter = port ?? createPreviewAdapter({preferredName});
  const notices = notifications ?? createNotificationStore();
  const store = createTurnoStore(adapter, notices);
  return {
    preferredName,
    homeSubtitle,
    port: adapter,
    store,
    notifications: notices,
    ...(noteProposals ? {noteProposals} : {}),
    dispose: () => store.dispose(),
  };
}
