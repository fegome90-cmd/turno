import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../app/App';
import {createPreviewAdapter} from '../adapters/preview-adapter';
import {AppProviders} from '../app/AppProviders';
import {createSession} from '../app/create-session';
import {OverlayProvider} from '../components/OverlayCoordinator';
import {LayoutHarness} from './LayoutHarness';
import '../styles/tokens.css';
import '../styles/global.css';
import '../styles/layout.css';

// Data-boundary fixture mounts the same App, store and port as the product.
// It is distinct from technical slots and never adds a product backdoor/global.
const fixture = new URLSearchParams(window.location.search).get('fixture');
const longFixture = fixture === 'product-long';
const delayedFixture = fixture === 'product-delayed';
const productFixture = longFixture || delayedFixture;
// Finite test-boundary latency only. The normal product entry never reads this query.
const delay = delayedFixture ? 1500 : 0;
const basePort = createPreviewAdapter({delay});
const longName = 'Lista de demostración 文字 العربية Español '.repeat(12).slice(0, 300);
const port = longFixture ? {...basePort, async load() {
  const snapshot = await basePort.load();
  return {...snapshot, beds: snapshot.beds.map((bed, index) => index === 0 ? {...bed, label: longName} : bed), tasks: snapshot.tasks.map((task, index) => index === 0 ? {...task, title: longName} : task)};
}} : basePort;
const session = createSession({random: () => 0, port, preferredName: longFixture ? longName : 'Demo'});
await session.store.getState().load();
session.store.getState().setView('workspace');
if (productFixture) session.store.getState().select({kind: 'task', id: 'task-1'});
createRoot(document.getElementById('root')!).render(<StrictMode><AppProviders>{productFixture ? <App session={session}/> : <OverlayProvider store={session.store}><LayoutHarness session={session}/></OverlayProvider>}</AppProviders></StrictMode>);
