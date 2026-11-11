// 2A · TemporalField usa la validación del dominio (src/domain/validation.ts), cerrando el punto de 1B (D11).
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import * as temporalField from '../../src/components/TemporalField';
import * as domainValidation from '../../src/domain/validation';
import {TemporalField} from '../../src/components/TemporalField';

describe('TemporalField y validación de dominio', () => {
  it('TEMPORAL-FIELD-DOMAIN · TemporalField usa validateTemporal de src/domain/validation.ts (misma función)', () => {
    expect(temporalField.validateTemporal).toBe(domainValidation.validateTemporal);
  });

  it('TEMPORAL-FIELD-DOMAIN · un campo de minutos con 1.5 muestra el error de dominio y conserva el texto crudo', () => {
    render(<TemporalField id="est" label="Estimación" kind="minutes" value="1.5" onValueChange={() => {}} />);
    expect(screen.getByText('Estimación: usa minutos enteros entre 0 y 1440.')).toBeInTheDocument();
    expect(screen.getByLabelText('Estimación')).toHaveValue('1.5');
  });
});
