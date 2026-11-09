import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProviders} from './AppProviders';
import {createSession} from './create-session';
import {Home} from '../components/Home';

export type StartAppOptions = {random: () => number};

// Arranque único del producto. La sesión (sorteo del subtítulo) se crea aquí, fuera del árbol de React,
// para que StrictMode no la repita al reevaluar render. Desmontar y volver a montar crea una sesión nueva.
export function startApp(container: HTMLElement | null, {random}: StartAppOptions): () => void {
  if (!container) throw new Error('Falta el contenedor #root');
  const session = createSession({random});
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <AppProviders>
        <Home
          preferredName={session.preferredName}
          subtitle={session.homeSubtitle}
          summary={{message: 'Turno de día · 4 pendientes', actionLabel: 'Ir al turno actual'}}
          onOpenShift={() => {}}
        />
      </AppProviders>
    </StrictMode>,
  );
  return () => root.unmount();
}
