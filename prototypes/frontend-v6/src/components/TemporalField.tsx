// Campo temporal crudo (1B): Field de Base UI + <input type="text">. No es NumberField:
// el texto que escribe la persona se conserva tal cual; la validación es una función pura que replica
// la regla de v5 (src/validation.mjs). Nunca corrige ni convierte vacío en cero.
import {Field} from '@base-ui/react/field';
import type {ReactNode} from 'react';
import {validateTemporal, type TemporalKind} from '../domain/validation';

// La regla vive en src/domain/validation.ts (2A): este componente solo la usa y la reexporta.
export {validateTemporal};
export type {TemporalKind};

export type TemporalFieldProps = {
  id: string;
  label: string;
  kind: TemporalKind;
  value: string;
  onValueChange: (raw: string) => void;
  hint?: ReactNode;
};

export function TemporalField({id, label, kind, value, onValueChange, hint}: TemporalFieldProps) {
  const error = validateTemporal(kind, label, value);
  return (
    <Field.Root id={`${id}-field`} invalid={error !== null} className="temporal-field">
      <Field.Label htmlFor={id}>{label}</Field.Label>
      <Field.Control
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? <Field.Description id={`${id}-hint`}>{hint}</Field.Description> : null}
      {error ? <Field.Error match={true}>{error}</Field.Error> : null}
    </Field.Root>
  );
}
