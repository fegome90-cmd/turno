import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProviders} from './AppProviders';
import {createSession} from './create-session';
import {App} from './App';

export type StartAppOptions = {random: () => number};

// Arranque único del producto. La sesión (sorteo del subtítulo) se crea aquí, fuera del árbol de React,
// para que StrictMode no la repita al reevaluar render. Desmontar y volver a montar crea una sesión nueva.
export function startApp(container: HTMLElement | null, {random}: StartAppOptions): () => void {
  if (!container) throw new Error('Falta el contenedor #root');
  const session = createSession({random});
  const root = createRoot(container);
  void session.store.getState().load();
  root.render(
    <StrictMode>
      <AppProviders>
        <App session={session}/>
      </AppProviders>
    </StrictMode>,
  );
  return () => {
    root.unmount();
    session.dispose();
  };
}
