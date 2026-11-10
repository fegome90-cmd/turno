import {useRef} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import {X} from 'lucide-react';
import {DomainNameForm, type NameFormProps} from './BedDialogs';
import '../styles/domain-dialogs.css';

export function DomainNameDialog({open, title, requestKey, onClosed, ...form}: Omit<NameFormProps, 'inputRef'> & {
  open: boolean; title: string; requestKey: number; onClosed(): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <Dialog.Root open={open} onOpenChange={(next, details) => {
    if (!next) {if (form.busy) details.cancel(); else form.onCancel();}
  }} onOpenChangeComplete={(next) => {if (!next) onClosed();}}>
    <Dialog.Portal>
      <Dialog.Backdrop className="overlay-backdrop"/>
      <Dialog.Popup className="demo-dialog domain-dialog" initialFocus={input} finalFocus={false}>
        <div className="domain-dialog-heading"><Dialog.Title>{title}</Dialog.Title><button type="button" className="icon-button" aria-label="Cerrar diálogo" disabled={form.busy} onClick={form.onCancel}><X size={20} aria-hidden="true"/></button></div>
        <Dialog.Description className="visually-hidden">Completa el nombre y confirma para aplicar el cambio en esta demostración.</Dialog.Description>
        <DomainNameForm key={requestKey} {...form} inputRef={input}/>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function CloseShiftDialog({open, shiftName, pending, busy, error, onCancel, onConfirm, onClosed}: {
  open: boolean; shiftName: string; pending: number; busy: boolean; error: string; onCancel(): void; onConfirm(): void; onClosed(): void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <Dialog.Root open={open} onOpenChange={(next, details) => {if (!next) {if (busy) details.cancel(); else onCancel();}}} onOpenChangeComplete={(next) => {if (!next) onClosed();}}>
    <Dialog.Portal><Dialog.Backdrop className="overlay-backdrop"/>
      <Dialog.Popup className="demo-dialog domain-dialog" initialFocus={cancel} finalFocus={false}>
        <Dialog.Title>Cerrar turno</Dialog.Title>
        <Dialog.Description>Se cerrará el turno «{shiftName}». <strong>{pending} {pending === 1 ? 'tarea pendiente' : 'tareas pendientes'}</strong> {pending === 1 ? 'se conservará' : 'se conservarán'} en el archivo.</Dialog.Description>
        <p>No se completarán ni pasarán al siguiente turno. Este prototipo no tiene avisos conectados.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="demo-actions"><button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Volver</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>Cerrar y archivar</button></div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
