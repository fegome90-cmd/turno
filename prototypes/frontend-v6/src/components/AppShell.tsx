import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import {Clock, PanelLeft, Power, X} from 'lucide-react';
import {getPanelMode} from '../appearance/panel-mode';
import {isLayerOpen, resolveReturnFocus, useOverlays} from './OverlayCoordinator';

type CloseShiftAction = {available: boolean; busy: boolean; onClick(): void};
export type AppShellProps = {
  navigation: ReactNode; editor: ReactNode; timePanel: ReactNode; closeShift?: CloseShiftAction;
  view: 'home' | 'workspace' | 'notes' | 'archive';
  title: string; inspectorHidden: boolean; onInspectorHidden(hidden: boolean): void;
  timePanelOwnsHeading?: boolean; onTimeOpenComplete?: () => void;
  timeInitialFocus?: () => HTMLElement | false;
  onPanelCloseComplete?: (id: 'navigation' | 'time') => void;
};

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    window.addEventListener('resize', read); document.addEventListener('fullscreenchange', read);
    return () => {window.removeEventListener('resize', read); document.removeEventListener('fullscreenchange', read);};
  }, []);
  return width;
}

// A permanent body portal per panel. Docking changes CSS and modality, never its DOM parent.
function DockedPanel({id, label, column, children, ownsHeading = false, onOpenComplete, onCloseComplete, requestedFocus, closeShift}: {id: 'navigation' | 'time'; label: string; column: boolean; children: ReactNode; ownsHeading?: boolean; onOpenComplete?: () => void; onCloseComplete?: () => void; requestedFocus?: () => HTMLElement | false; closeShift?: CloseShiftAction}) {
  const overlays = useOverlays();
  const popup = useRef<HTMLDivElement>(null);
  const wasColumn = useRef(column);
  const wasModal = useRef(!column && isLayerOpen(overlays.state, id));
  const shown = column || isLayerOpen(overlays.state, id);
  const focusKey = id === 'navigation' ? 'open-nav' : 'open-time';
  useLayoutEffect(() => {
    const changedBand = wasColumn.current !== column;
    const focusedDisclosure = id === 'navigation' && document.getElementById('more-options')?.contains(document.activeElement);
    if (id === 'navigation' && changedBand && isLayerOpen(overlays.state, 'more')) {
      // The disclosure cannot stay open when its navigation anchor changes mode.
      // Restore only focus that belonged to it, never an unrelated editor intent.
      overlays.close('more');
      if (focusedDisclosure) {
        const target = resolveReturnFocus(column ? 'more-trigger' : focusKey);
        if (target) target.focus();
      }
    }
    if (column && !wasColumn.current && isLayerOpen(overlays.state, id)) overlays.close(id);
    if (wasColumn.current && !column && !shown && popup.current?.contains(document.activeElement)) {
      const target = resolveReturnFocus(focusKey); if (target) target.focus();
    }
    wasColumn.current = column;
  }, [column, shown, focusKey, overlays, id]);
  useEffect(() => {
    const yieldedModality = wasModal.current && column;
    wasModal.current = !column && shown;
    // A drawer can become a column without an open=false transition. Passive cleanup
    // has released its modal behavior before a pending product intention is delivered.
    if (yieldedModality) onCloseComplete?.();
  }, [column, shown, onCloseComplete]);
  return <Dialog.Root open={shown} modal={!column} disablePointerDismissal={column} onOpenChangeComplete={(open) => {if (open) onOpenComplete?.(); else onCloseComplete?.();}} onOpenChange={(open, details) => {
    if (column || overlays.state.layers.at(-1)?.id !== id) {
      details.cancel();
      // A docked/non-top panel must not consume Escape meant for the actual top layer.
      if (details.reason === 'escape-key') details.allowPropagation();
      return;
    }
    if (!open) overlays.close(id);
  }}>
    <Dialog.Portal keepMounted>
      <Dialog.Backdrop className={`overlay-backdrop ${column ? 'docked-backdrop' : ''}`}/>
      <Dialog.Popup ref={popup} id={`${id}-panel`} role={column ? 'complementary' : 'dialog'} aria-label={label}
        className={`shell-panel ${id}-panel ${column ? 'is-column' : 'is-drawer'}`}
        data-panel-mode={column ? 'column' : 'drawer'}
        initialFocus={() => requestedFocus?.() || (column ? false : true)}
        finalFocus={() => {
          // An explicit Base UI return target otherwise overrides a newer focus intent.
          // Narrowing transfers focus itself only when the now-hidden panel owned it.
          if (column || overlays.state.layers.length > 0 || !popup.current?.contains(document.activeElement)) return false;
          return resolveReturnFocus(focusKey) || resolveReturnFocus('brand');
        }}>
        <Dialog.Title className="visually-hidden">{label}</Dialog.Title>
        {!column && !ownsHeading && <div className={`panel-heading ${id === 'time' ? 'time-panel-heading' : ''}`}>
          {id === 'navigation' && closeShift?.available !== false && <button type="button" className="close-shift-button" data-focus-key="close-shift-drawer" aria-label="Cerrar turno" disabled={!closeShift || closeShift.busy} onClick={closeShift?.onClick}><Power size={20} aria-hidden="true"/><span>Cerrar turno</span></button>}
          <Dialog.Close className="panel-close icon-button" aria-label={`Cerrar ${label.toLowerCase()}`}><X aria-hidden="true" size={20}/></Dialog.Close>
        </div>}
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function AppShell({navigation, editor, timePanel, view, title, inspectorHidden, onInspectorHidden, timePanelOwnsHeading, onTimeOpenComplete, timeInitialFocus, onPanelCloseComplete, closeShift}: AppShellProps) {
  const width = useViewportWidth();
  const mode = getPanelMode(width);
  const overlays = useOverlays();
  const navColumn = mode.navigation === 'column';
  const timeColumn = mode.time === 'column' && view !== 'home' && !inspectorHidden;

  return <div className={`app-shell ${navColumn ? 'has-navigation' : ''} ${timeColumn ? 'has-time' : ''}`} data-testid="app-shell">
    <DockedPanel closeShift={closeShift} id="navigation" label="Navegación" column={navColumn} onCloseComplete={() => onPanelCloseComplete?.('navigation')}>{navigation}</DockedPanel>
    <div className="workspace">
      <header className="toolbar"><div className="toolbar-leading">
        <button type="button" className="navigation-trigger icon-button" hidden={navColumn} data-focus-key="open-nav" aria-label="Abrir navegación" aria-controls="navigation-panel" aria-expanded={isLayerOpen(overlays.state, 'navigation')} onClick={() => overlays.open({id: 'navigation', kind: 'navigation', returnFocusKey: 'open-nav'})}><PanelLeft aria-hidden="true" size={20}/></button>
        <span className="toolbar-title">{title}</span>
      </div><div className="toolbar-trailing">
        {closeShift?.available !== false && <button type="button" className="close-shift-button" data-focus-key="close-shift-toolbar" aria-label="Cerrar turno" disabled={!closeShift || closeShift.busy} onClick={closeShift?.onClick}><Power size={20} aria-hidden="true"/><span>Cerrar turno</span></button>}
        <button type="button" className="icon-button" data-focus-key="open-time" aria-label={timeColumn ? 'Ocultar Tiempo' : 'Mostrar Tiempo'} aria-controls="time-panel" aria-expanded={timeColumn || isLayerOpen(overlays.state, 'time')} onClick={() => {
          if (timeColumn) onInspectorHidden(true);
          else if (mode.time === 'column' && view !== 'home' && inspectorHidden) onInspectorHidden(false);
          else if (isLayerOpen(overlays.state, 'time')) overlays.close('time');
          else overlays.open({id: 'time', kind: 'time', returnFocusKey: 'open-time'});
        }}><Clock aria-hidden="true" size={20}/><span className="visually-hidden">{timeColumn ? 'Ocultar Tiempo' : 'Mostrar Tiempo'}</span></button>

      </div></header>
      {editor}
    </div>
    <DockedPanel id="time" label="Tiempo" column={timeColumn} ownsHeading={timePanelOwnsHeading} onOpenComplete={onTimeOpenComplete} requestedFocus={timeInitialFocus} onCloseComplete={() => onPanelCloseComplete?.('time')}>{timePanel}</DockedPanel>
  </div>;
}
