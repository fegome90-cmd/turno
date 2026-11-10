import {useEffect, useRef, useState, type RefObject} from 'react';
import {Field} from '@base-ui/react/field';
import {Form} from '@base-ui/react/form';
import type {DomainResult} from '../app/store';

export type NameFormProps = {
  label: string; action: string; initial: string; rename: boolean; busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onEdit(): void; onCancel(): void;
  onSubmit(value: string): Promise<DomainResult<{id: string}>>;
};

// One raw/error owner for the lifetime of one domain-dialog request.
export function DomainNameForm({label, action, initial, rename, busy, inputRef, onEdit, onCancel, onSubmit}: NameFormProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const submitted = useRef(false);
  const revision = useRef(0), alive = useRef(true), composing = useRef(false);
  useEffect(() => {alive.current = true; return () => {alive.current = false; revision.current += 1;};}, []);
  const submit = async () => {
    if (busy || composing.current || submitted.current) return;
    if (!value.trim() || value.length > 300) {
      setInvalid(true); setError((rename ? 'Nombre de la lista' : label.startsWith('Título') ? 'Título' : 'Nombre') + ': escribe de 1 a 300 caracteres.');
      inputRef.current?.focus(); return;
    }
    const started = revision.current;
    setInvalid(false); setError('');
    // A request owns one successful submission, including the closing interval.
    // A ref also covers repeated submits before busy reaches this render.
    submitted.current = true;
    let result: DomainResult<{id: string}>;
    try {
      result = await onSubmit(value);
      submitted.current = result.status === 'saved' || result.status === 'noop';
      if (alive.current && submitted.current) setConfirmed(true);
    } catch (error) {
      submitted.current = false;
      throw error;
    }
    if (!alive.current || revision.current !== started) return;
    if (result.status === 'invalid' || result.status === 'error') {
      setError(result.message); setInvalid(result.status === 'invalid');
      if (result.status === 'invalid') inputRef.current?.focus();
    }
  };
  return <Form noValidate onSubmit={(event) => {event.preventDefault(); void submit();}}>
    <Field.Root name="domain-name" invalid={invalid}>
      <Field.Label htmlFor="domain-name">{label}</Field.Label>
      <Field.Control ref={inputRef} id="domain-name" name="domain-name" className="domain-name-input" type="text" required maxLength={300}
        value={value} readOnly={busy || confirmed} aria-describedby={'domain-name-hint' + (error ? ' domain-name-error' : '')}
        onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}
        onChange={(event) => {
          if (busy || confirmed) return;
          revision.current += 1; onEdit(); setValue(event.currentTarget.value);
          if (invalid && event.currentTarget.value.trim() && event.currentTarget.value.length <= 300) {setInvalid(false); setError('');}
        }}/>
      <Field.Description id="domain-name-hint">{rename ? 'Las tareas permanecen en esta lista. Solo cambia su nombre en esta demostración.' : 'Solo contenido de prueba, sin datos de pacientes.'}</Field.Description>
      {error && <Field.Error match={true} id="domain-name-error" className="field-error error" role="alert">{error}</Field.Error>}
    </Field.Root>
    <div className="demo-actions">
      <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="primary" disabled={busy || confirmed}>{action}</button>
    </div>
  </Form>;
}
