import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProviders} from './app/AppProviders';
import {createSession} from './app/create-session';
import {Home} from './components/Home';
import './styles/tokens.css';
import './styles/global.css';

// Una sesión por carga: el subtítulo se sortea aquí, fuera del árbol de React.
const session = createSession();
const container = document.getElementById('root');
if (!container) throw new Error('Falta el contenedor #root');

createRoot(container).render(
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
