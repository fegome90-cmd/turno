import {useEffect, useRef} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import type {PreviewPort} from '../adapters/turno-port';
import {resolveReturnFocus, useOverlays} from './OverlayCoordinator';

export function DemoDialog({port}: {port: PreviewPort}) {
  const {state, close} = useOverlays();
  const layer = state.layers.find((item) => item.id === 'demo');
  const returnKey = useRef('more-trigger');
  useEffect(() => {if (layer?.returnFocusKey) returnKey.current = layer.returnFocusKey;}, [layer]);
  const arm = (kind: 'error' | 'conflict') => {port.failNext(kind); close('demo');};
  return <Dialog.Root open={!!layer} onOpenChange={(shown, details) => {
    if (!shown && state.layers.at(-1)?.id === 'demo') close('demo'); else if (!shown) details.cancel();
  }}>
    <Dialog.Portal><Dialog.Backdrop className="overlay-backdrop"/>
      <Dialog.Popup className="demo-dialog" finalFocus={() => resolveReturnFocus(returnKey.current) || resolveReturnFocus('open-nav') || resolveReturnFocus('home-primary')}>
        <Dialog.Title>Demostración local</Dialog.Title>
        <Dialog.Description>Esta interfaz usa datos sintéticos y memoria temporal. Al recargar se restablece el ejemplo. No hay conexión con Supabase, ChatGPT ni avisos.</Dialog.Description>
        <div className="demo-actions"><button onClick={() => arm('error')}>Simular fallo</button><button onClick={() => arm('conflict')}>Simular conflicto</button></div>
        <Dialog.Close>Cerrar</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
