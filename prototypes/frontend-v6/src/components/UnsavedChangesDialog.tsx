// Reuse the installed Base UI Dialog and the existing session dialog styling.
// shadcn registry inspection is blocked; no uninspected preset is installed.
import {useRef} from 'react';
import {Dialog} from '@base-ui/react/dialog';

export function UnsavedChangesDialog({open, busy, onCancel, onDiscard, onSave, onClosed}: {
  open: boolean; busy: boolean; onCancel(): void; onDiscard(): void; onSave(): void;
  onClosed(): void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <Dialog.Root open={open} onOpenChange={(next, details) => {
    if (!next) {if (busy) details.cancel(); else onCancel();}
  }} onOpenChangeComplete={(next) => {if (!next) onClosed();}}>
    <Dialog.Portal>
      <Dialog.Backdrop className="overlay-backdrop"/>
      {/* Return focus is an intention checked after close-complete, not a captured stale element. */}
      <Dialog.Popup className="demo-dialog unsaved-dialog" initialFocus={cancel} finalFocus={false}>
        <Dialog.Title>Hay cambios sin guardar</Dialog.Title>
        <Dialog.Description>Tu borrador todavía no se ha guardado en esta demostración.</Dialog.Description>
        <div className="demo-actions">
          <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Volver</button>
          <button type="button" disabled={busy} onClick={onDiscard}>Descartar cambios</button>
          <button type="button" className="primary" disabled={busy} onClick={onSave}>{busy ? 'Guardando…' : 'Guardar y continuar'}</button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
