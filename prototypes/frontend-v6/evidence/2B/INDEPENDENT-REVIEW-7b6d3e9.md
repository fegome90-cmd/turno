# Revisión independiente 2B · 7b6d3e9

## Resultado

**PASS de la revisión técnica no visual del fix. STOP para aprobar G2B: falta ejecutar el gate Chromium real file/HTTP y consolidar su evidencia.**

Se revisó el candidato inicial 3c25f6d99a4bf10c3c4ef0dfd1189c8190726417, se encontraron dos reproducciones de una misma carrera bloqueante y se verificó su corrección en **7b6d3e9dad978859a286384881bf3f05fc9cc25b**. No quedan hallazgos funcionales bloqueantes confirmados en la revisión no visual del último SHA. Esto no aprueba comportamiento de navegador, foco real, accesibilidad integral ni producto integrado.

## Trazabilidad

- Base 2A: e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b.
- Candidato revisado: 7b6d3e9dad978859a286384881bf3f05fc9cc25b, commit local, no publicado.
- Árbol: 8c78fe291f141cbffca9900248f6ce3c39287c13.
- Copia independiente: /workspace/scratch/ae7ea9e7b2f5/turno-2b-review.
- Copia de pruebas adversariales: /workspace/scratch/ae7ea9e7b2f5/turno-2b-adversarial.
- No modifiqué el checkout de Sol. La copia exacta de revisión permanece limpia; los tests adicionales viven fuera de ella.
- Cambio total de producto: 11 archivos dentro de frontend-v6; controlador/hook, harness separado, tests y dist-history en gitignore. Sin cambios a v5, dominio/store 2A, package.json, lock, backend ni despliegue.

## Hallazgo bloqueante encontrado y corregido

**H1 · Un popstate tardío podía sobrescribir una intención nueva.**

En 3c25f6d:
1. Pila Home/A/B, vista A, B disponible en Forward.
2. Guardia pending para Back y compensación completa hasta A.
3. resume inicia replay hacia Home; antes de entregar su popstate se llama push(newer).
4. El popstate antiguo se procesa como navegación nueva: la vista acaba Home mientras history.state contiene newer.

Variante: browser.move(-1), sin entregar aún el popstate, seguido de push(newer). Mismo resultado incorrecto.

Causa: push borraba replay sin conservar el viaje físico en curso; onPopState aceptaba eventos sin contrastarlos con la entrada física actual. Fuente inicial: history-controller.ts:72–74,124–128,157.

Evidencia RED independiente:
- adversarial-replay.log: 1 fallo adicional; los 20 originales pasan.
- adversarial-queued-events.log: 2 fallos adicionales; los 20 originales pasan.
- Test conservado: fix/source-artifacts/independent-history-repro.test.ts.

Fix 7b6d3e9:
- history-controller.ts:104–110 descarta popstate que ya no coincide con history.state.
- :129–135 conserva y compensa el replay antes de aplicar la intención más reciente.
- :165–177 serializa pushes durante replay/retorno y reconcilia entrada física vs origen lógico.
- Las dos reproducciones independientes pasan: **22/22**, fix/adversarial-replay-and-queued.log.
- El nuevo push se ramifica desde la ruta visible original después de compensar, en lugar de la posición transitoria. La aserción de índice del segundo repro se ajustó a ese contrato coherente (idx2; Back vuelve a A), sin debilitar conservación de selección, título ni sincronía.

El implementador agregó cinco casos de regresión del mismo problema: replay Back/Forward, misma ruta durante replay y push antes de entregar popstate de usuario en ambas direcciones.

## Gates repetidos sobre 7b6d3e9

| Gate | Resultado | Evidencia |
|---|---|---|
| Instalación limpia del candidato inicial con el mismo lock | PASS | npm-ci.log |
| Suite unit completa final | PASS 99/99, 7 archivos | fix/test-unit.log |
| Suite componentes completa final | PASS 56/56, 7 archivos | fix/test-component.log |
| typecheck | PASS, exit 0 | fix/typecheck.log |
| lint | PASS, exit 0 | fix/lint.log |
| build producto | PASS, exit 0 | fix/build.log |
| build harness separado | PASS, exit 0 | fix/build-history.log |
| audit-total / audit-runtime | PASS, ambos 0 vulnerabilidades | fix/audit-total.json, fix/audit-runtime.json |
| Repros independientes iniciales contra fix | PASS 22/22 | fix/adversarial-replay-and-queued.log |
| Playwright history --list | 18 casos descubiertos; no ejecutados | fix/e2e-discovery.log |
| git diff --check / árbol limpio | PASS | fix/context.json |
| Chromium file/HTTP | BLOCKED aquí; pendiente de worker Mac | Sin PASS de browser |

Producto: **ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343**, idéntico a 2A.
Harness: **958f133a58469020677cb1ba5b24c143f892f694b65132e2cdf3af774331fb19**.
Node v24.22.1. Package/lock y contexto completo: fix/context.json.

## Qué revisé

- Inicialización replace, sin push extra ni cambio de URL; conservación de datos ajenos del estado inicial.
- Identificación por owner/idx; nueva sección de historial después de entrada externa; reattach y APIs de History fallidas.
- Una entrada por ruta distinta; identidad incluye kind/id/archive/view; copias de rutas no mutables desde fuera.
- Back/Forward y saltos múltiples; compensación sin push que trunque Forward.
- Guardias allow/blocked/pending; reanudación una sola vez; cancelación mediante descarte del callback e invalidación.
- Nueva intención durante compensación, replay y popstate todavía pendiente.
- start/dispose idempotentes, 20 ciclos, StrictMode y un listener por montaje.
- Hook mantiene callbacks del último render confirmado y transporte fijo durante montaje.
- Harness conserva texto crudo ante cancelar/fallo, reintenta y navega solo con éxito explícito.
- Cancelar durante guardado invalida su resultado, aun sin nueva navegación; una selección/borrador más reciente queda intacta.
- El harness no toma Promise<void> del store como éxito de guardado.
- Se conserva regresión 2A dentro de suites completas. No hay import del controlador/harness en el Home de producto.

## Pendientes y límites

1. **G2B requiere navegador real.** Los tests unit usan una pila simulada. Aunque separan movimiento y entrega de popstate, no prueban todos los tiempos nativos de Chromium. El worker Mac debe repetir los 18 escenarios file/HTTP y añadir explícitamente las carreras de H1. Ya coordinado.
2. **Foco, teclado y estados accesibles reales pendientes.** Hay aserciones E2E de retorno visible, foco no robado, título y borrador, pero discovery no las ejecuta. No otorgo aprobación visual ni de accesibilidad.
3. **Evidencia del implementador aún en consolidación.** Al leer REPORT.md y artifact-sizes.json después del fix todavía citaban el SHA inicial,94 unit y harness9237429e. Se notificó a Sol para actualizarlos antes del paquete final; no usar esos valores viejos como evidencia del fix.
4. **Sin cierre prematuro de paridad.** HISTORY-01–05/07–09 esperan integración 4A; HISTORY-06 espera 4B. IME corresponde a 4A/7B. El harness 2B no certifica TaskEditor, BedDialogs, host ChatGPT ni la aplicación completa.
5. **Contrato formal.** Debe verificarse el reporte estructurado final con sus hashes/gates sobre el árbol efectivo; un STOP correctamente formado no es autorización para continuar.
6. **Chromium cloud no relanzado.** Existe diagnóstico anterior de socket() Operation not permitted incluso tras intento escalado. No se sustituyó browser por JSDOM ni se ocultó el bloqueo.

## Design Skills Router

Se incorporó a petición del usuario **Design Skills Router 0.2.1**:
- Lectura de skill, PILOT, ASSISTANCE, CLI y árbol canónico.
- verify-package: baseline_verified=true,82 referencias. Esto valida el paquete, no Turno.
- Marco aplicable: AC01/QA01, estados de interacción, criterio verificable, evidencia y límites por dominio.
- Fuentes originales recuperadas como REFERENCE_ONLY en commit jakubkrehel/skills@157da62016338e8693dcff93d47154a9e36f2157:
  - better-accessibility: blob5e9ab11b4c109d56c435731198ed23ba0267e529.
  - better-writing: blob54f93d31197446fc5b4d8645fddaa3ec91baa5c2.
- Bytes originales y Git blob verificados en router-sources/. Se separan recomendaciones de criterios normativos.
- No inicié expediente, transición ni aprobación ficticia. Sin expediente y aceptación exacta no se afirma una fase del router completada.
- Para el recorrido Mac: teclado completo, foco visible/restaurado, nombres/roles/estados, errores anunciados y recuperables, título/foco de destino sin robo por callbacks antiguos. Lector de pantalla, zoom y contraste requieren observación específica si se quiere afirmarlos.
- Se conserva Base UI Dialog y la identidad existente; no se introduce rediseño por esta auditoría.

## Decisión para orquestación

El fix es apto para pasar a verificación de navegador en el alcance técnico de 2B. **No aprobar G2B ni pasar a 3A con Chromium requerido pendiente.** Conservar el RED original y la corrección, cerrar evidencia del SHA final y repetir lo afectado si cambia el código.

