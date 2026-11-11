import type {RefObject} from 'react';
import {Popover} from '@base-ui/react/popover';
import {Settings} from 'lucide-react';
import type {ThemePreference} from '../appearance/theme-provider';
import {isLayerOpen, resolveReturnFocus, useOverlays} from './OverlayCoordinator';

export type MoreOptionsProps = {anchor?: RefObject<HTMLElement | null>; theme: ThemePreference; onThemeChange(theme: ThemePreference): void; onDemo(): void};

export function MoreOptions({anchor, theme, onThemeChange, onDemo}: MoreOptionsProps) {
  const {state, open, close} = useOverlays();
  const shown = isLayerOpen(state, 'more');
  return <Popover.Root open={shown} modal={false} onOpenChange={(value, details) => {
    if (value) open({id: 'more', kind: 'more', returnFocusKey: 'more-trigger'});
    else if (state.layers.at(-1)?.id === 'more') close('more');
    else details.cancel();
  }}>
    <Popover.Trigger className="footer-action" data-focus-key="more-trigger" aria-controls="more-options" aria-expanded={shown}>
      <Settings aria-hidden="true" size={20}/><span>Más opciones</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner anchor={anchor} side="top" align="end" sideOffset={8} className="more-positioner">
        <Popover.Popup id="more-options" className="more-options" initialFocus={false} finalFocus={(type) => {
          if (type !== 'keyboard') return false;
          const target = resolveReturnFocus('more-trigger');
          return target && !target.closest('[data-closed]') ? target : false;
        }}>
          <Popover.Title className="visually-hidden">Más opciones</Popover.Title>
          <button type="button" className="nav-item" aria-label="Demo local: datos sintéticos" onClick={onDemo}><Settings aria-hidden="true" size={20}/>Demo local</button>
          <p>Datos sintéticos · Se reinician al recargar</p>
          <label className="theme-control" htmlFor="theme-preference"><span>Apariencia</span><select id="theme-preference" value={theme} onChange={(event) => onThemeChange(event.target.value as ThemePreference)}>
            <option value="system">Usar el sistema</option><option value="light">Clara</option><option value="dark">Oscura</option>
          </select></label>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
