// Entrada del harness de 1B. Solo harness.html la carga; dist/preview.html no la importa.
import {createRoot} from 'react-dom/client';
import {HarnessApp} from './Harness';
import {createNotificationStore} from '../notifications/notification-store';
import '../styles/tokens.css';
import '../styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta #root');
createRoot(container).render(<HarnessApp store={createNotificationStore()} />);
