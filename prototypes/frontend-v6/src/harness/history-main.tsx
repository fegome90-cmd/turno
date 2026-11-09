import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {OverlayProvider} from '../components/OverlayCoordinator';
import {HistoryHarness} from './HistoryHarness';
import '../styles/tokens.css';
import '../styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root del harness');
createRoot(root).render(<StrictMode><OverlayProvider><HistoryHarness /></OverlayProvider></StrictMode>);
