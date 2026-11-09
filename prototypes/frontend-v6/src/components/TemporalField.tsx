// Campo temporal crudo (1B): Field de Base UI + <input type="text">. No es NumberField:
// el texto que escribe la persona se conserva tal cual; la validación es una función pura que replica
// la regla de v5 (src/validation.mjs). Nunca corrige ni convierte vacío en cero.
import {Field} from '@base-ui/react/field';
import type {ReactNode} from 'react';

export type TemporalKind = 'time' | 'minutes';

// Regla v5: hora 24 h HH:MM; minutos enteros 0–1440; vacío es válido y no es cero. Devuelve null si es válido.
export function validateTemporal(kind: TemporalKind, label: string, raw: string): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (kind === 'time') {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? null : `${label}: usa una hora de 24 horas, por ejemplo 14:30.`;
  }
  return !/^\d+$/.test(value) || Number(value) > 1440 ? `${label}: usa minutos enteros entre 0 y 1440.` : null;
}

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
