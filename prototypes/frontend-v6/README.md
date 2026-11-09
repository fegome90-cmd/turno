# Turno v6 · estado de la migración

Aplicación React aislada, sólo con datos sintéticos y memoria de sesión. No conecta backend, autenticación, persistencia ni host ChatGPT.

La referencia de planificación y sus contratos canónicos viven en `../../docs/migration-v6/`. Son documentos históricos y de contrato, no una matriz de ejecución actualizada automáticamente.

Registros actuales:

- [Reconciliación de 2A](docs/EXECUTION-2A-RECONCILIATION.md): dominio, adaptador y store; 30 requisitos no visuales trazados.
- [Ejecución de 2B](docs/EXECUTION-2B.md): controlador/hook de historial y harness técnico de rutas/guardas/capas.
- [Matriz de ejecución](docs/parity-map.json): conserva 212 identidades y contratos canónicos; 30 verified no visuales de 2A y 182 planned. HISTORY continúa planned hasta integración 4A/4B.
- [Evidencia 2A reconciliada](evidence/2A/reconciliation-20261109/) y [evidencia 2B](evidence/2B/).

## Uso y pruebas

Node 24.22.1 y dependencias fijadas por package-lock. Instalar con `npm ci` y ejecutar `npm run typecheck`, `npm run lint`, `npm run test:unit` y `npm run test:component`.

`npm run build` genera `dist/preview.html`, el producto Home mínimo. `node scripts/build-history-harness.mjs` genera aparte `dist-history/history-harness.html`; el harness no se importa desde el producto.

`npm run test:e2e -- history.spec.ts` ejecuta el historial técnico. La suite completa se ejecuta con `npm run test:e2e`. La configuración versionada selecciona Chromium Linux; QA Mac usó un adaptador externo incluido en su evidencia para elegir Chrome instalado. No se cambiaron escenarios ni timeouts.

La portabilidad de un HTML autónomo, la integración de editores y la integración real del host son entregables distintos. Las pruebas simuladas no acreditan foco nativo, lector de pantalla, IME real ni dispositivo. El cierre de fase requiere revisión independiente y el checker de contrato sobre el snapshot final; pasar ese checker sólo valida metadatos e integridad.

## Fuera del cierre actual

No se certifica producto integrado, Firefox/WebKit, lector de pantalla, IME real, revisión visual manual independiente ni host. `check:parity` y el smoke de otros motores siguen pendientes de sus fases: no se presentan como gates verdes. No hay merge ni despliegue autorizado por estos registros.
