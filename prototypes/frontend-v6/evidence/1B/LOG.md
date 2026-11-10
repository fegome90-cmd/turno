# Log de ejecución · Fase 1B (frontend-v6)

Implementador: agente Claude (Haiku 5.5). Rama `claude/confident-galileo-rahzv6`. Base de 1B: HEAD `4012e99b34d4317a83326d5b1b996ac4dede301d` (árbol limpio al empezar; 1A ya en `90b1c6b`, brief en `4012e99`). Sin commit, push ni PR.
Entorno: Node v24.22.1, npm 11.19.1, Chromium `/opt/pw-browsers/chromium` (sin `playwright install`). Un worker.
Versiones fijadas (verificadas en node_modules): `@base-ui/react` 1.9.0, `sonner` 2.0.8.
Comandos: cada uno con `export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH`.

## Paso 0 · Bootstrap (inicio)

- Pendiente: extraer `startApp` a `src/app/bootstrap.tsx`; prueba `EXTRA-STRICTMODE-HOME` y sonda del script inline de `preview.html` (observación 2 de 1A).

## Paso 0 · Bootstrap (08-09/11/2026) · RED/GREEN y mutaciones

- Prueba escrita primero: `tests/component/bootstrap.test.tsx` (EXTRA-STRICTMODE-HOME ×3; EXTRA-OFFLINE-FIRST-PAINT-SCRIPT ×1). Con `src/app/bootstrap.tsx` como stub sin comportamiento. Comando: `npx vitest run --project component tests/component/bootstrap.test.tsx --maxWorkers=1 --no-file-parallelism`. Código 1. Log `evidence/1B/red-bootstrap.log`: 3 fallos por aserción (`expected "vi.fn()" to be called 1 times, but got 0 times`; `expected 0 to be greater than 0`). La prueba de script inline pasó: es guarda de regresión del script que ya existe, no RED funcional.
- Implementación mínima: `src/app/bootstrap.tsx` exporta `startApp(container, {random})`: `createSession` fuera del árbol, `createRoot`, `<StrictMode>`, devuelve `unmount`. `src/main.tsx` solo llama `startApp(document.getElementById('root'), {random: Math.random})`. Comando: mismo; código 0, 4/4, log `evidence/1B/green-bootstrap.log`. `npm run test:component` código 0, 16/16 (`green-component-step0.log`).
- Mutaciones (copia en el scratchpad, `node_modules` enlazado; código de cada una, 1 = la prueba la detecta):
  - a) `Math.random()` descartado dentro de `Home` → código 1 (`expected "random" to not be called at all, but actually been called 2 times`). Log `mut-step0-a-math-random-in-home.log`.
  - b) `createSession` dentro de un componente bajo StrictMode → código 1 (`expected "vi.fn()" to be called 1 times, but got 2 times`). Log `mut-step0-b-createsession-in-component.log`.
  - c) StrictMode quitado → código 1 (`expected 1 to be 2`). Log `mut-step0-c-no-strictmode.log`.
  - d) script inline de tema eliminado de `preview.html` → código 1 (`expected null not to be null`). Log `mut-step0-d-no-inline-theme-script.log`.
  - Control sin mutar: código 0, 4/4 (`mut-step0-control.log`).

## Paso 1 · NumberField primero (decisión, 09/11/2026)

- Prueba de contrato escrita en `tests/component/primitive-contract.test.tsx` (`G1B-NUMBERFIELD-RAW`, locale `es-CL`, sin min/max). Ejecución sin implementación previa de NumberField: `red-primitive-contract-probe.log`.
- Sonda de comportamiento (en copia del scratchpad, no en el producto), `numberfield-probe-output.txt` y `numberfield-probe.test.tsx.txt`. Escritura → blur, Base UI 1.9.0, `NumberField.Root` sin clamp:

| Caso escrito | es-CL: tras escribir | es-CL: tras blur | en-US: tras blur |
|---|---|---|---|
| `abc` | vacío (letras descartadas) | vacío | vacío |
| `-1` | `-1` | `-1` | `-1` |
| `1.5` | `1.5` | **`15`** (el punto se toma como separador de miles) | `1.5` |
| `1441` | `1441` | **`1.441`** | **`1,441`** |
| `0` | `0` | `0` | `0` |
| `1000` | `1000` | **`1.000`** | **`1,000`** |
| `999` | `999` | `999` | `999` |

- Resultado: **NumberField no conserva el texto crudo** (`abc` se descarta, `1.5` pierde el decimal en es-CL, `1441`/`1000` se reformatean en blur). Vacío no pasa a 0 y no hay clamp. Casos de panel cerrado/reabierto, tema y docking 999↔1000 no se ejecutaron porque el contrato ya falla en escritura/blur (NOT RUN).
- Decisión aplicada: **no se parchea NumberField por dentro**; se continúa con `TemporalField` (Field + input text + validador puro v5). **STOP parcial de decisión del dueño** para G1B en este punto.
- Los tres casos fallidos de `NumberField` quedan como FAIL por aserción en `test:component` (sin `skip`).
- Nota de implementación de TemporalField: el primer intento devolvía error no visible (Field.Error solo renderiza con validez nativa o `match`); corregido con `match={true}` para el error propio, sin cambiar expectativas (`red-primitive-contract-probe.log` y `red-primitive-contract-after-temporal-fix.log`).

## Paso 2 · Pruebas 1B escritas primero (RED por aserción)

- `tests/component/primitive-contract.test.tsx` y `tests/e2e/primitive-contract.spec.ts` escritos antes de la implementación, con módulos stub que solo existían para importar (`OverlayCoordinator`, `notification-store`, `sonner-adapter`, `NotificationStack`, `harness/Harness`). Un stub sin comportamiento no es RED funcional por sí solo: el RED es por aserción o por elemento ausente en el comportamiento esperado.
- Comandos: `npx vitest run --project component tests/component/primitive-contract.test.tsx --maxWorkers=1 --no-file-parallelism` → código 1, `red-primitive-contract.log` (18 de 29 fallaron por aserción o elemento ausente; 11 pasaron: TemporalField/validador, vacío de NumberField y pruebas de tema que no dependen de los stubs). `npx playwright test tests/e2e/primitive-contract.spec.ts --project=chromium --workers=1` → código 1, `red-primitive-contract-e2e.log` (7/7 con «elemento no encontrado» en el harness stub).
- Incidente de entorno (no RED funcional): Playwright con `video: 'retain-on-failure'` requiere `/opt/pw-browsers/ffmpeg-1013`, que no existe (solo ffmpeg-1011). Antes de cualquier prueba funcional falló con «Executable doesn't exist». Se cambió `video` a `'off'` en `playwright.config.ts` (desviación documentada; trace y screenshot en fallo siguen activos). No se instaló nada.

## Paso 3 · Implementación mínima (GREEN)

- `src/components/TemporalField.tsx`: Field + input texto; validador puro `validateTemporal` con la regla v5 (minutos enteros 0–1440; hora 24 h; vacío válido).
- `src/components/OverlayCoordinator.tsx`: reductor puro (`overlayReducer`), `OverlayProvider`, `useOverlays`, `resolveReturnFocus` (`data-focus-key`, conectado y no inerte).
- `src/notifications/notification-store.ts`: fuente de verdad; ids globales; repetidos suman `count`; sin expulsión.
- `src/notifications/sonner-adapter.ts`: presenta desde el store con `toast()`/`toast.error()`; `duration: Infinity`; suspensión difiere la presentación; descarte por teclado enfoca el cierre siguiente; fallo de presentación → `markFailed`, sin marcar como presentado.
- `src/notifications/NotificationStack.tsx`: contenedor inerte cuando hay modal + `Toaster` con `visibleToasts` 1000.
- `src/harness/Harness.tsx`, `src/harness/main.tsx`, `src/harness/Harness.css`, `harness.html` (raíz del proyecto, no entra en `dist/preview.html`; lo sirve solo `vite` dev en el puerto 4177 desde `playwright.config.ts` → `webServer`).
- Resultado de la misma prueba de componente: `npm run test:component` → código 1, 46 pasan y **3 fallan** (las tres de NumberField, STOP).

## Paso 3b · Correcciones de prueba durante GREEN (sin cambiar expectativas)

- `Field.Error` requiere `match={true}` para mostrar el error propio (TemporalField).
- Con modal abierto la búsqueda por rol excluye el campo (queda `aria-hidden`); el test de «portal no duplica» cuenta nodos `#estimate` en el DOM.
- `act()` alrededor de `setSuspended` en el test de inercia (React necesita flush).
- Sonner guarda sus toasts en estado global y reenvía los activos a cada Toaster nuevo: `afterEach` llama a `toast.dismiss()` para aislar las pruebas.
- `getHistory()` de Sonner no sirve como contador: ids repetidos se tratan como actualización. Se cambió a contar presentaciones con un presentador envolvente y los ids del store son globales.
- El test de ciclo con StrictMode calienta una vez antes de medir: user-event añade un listener `selectionchange` en el primer uso (no es del producto).
- e2e de contraste: la primera versión medía con los capas cerradas; se reescribió para medir popover, aviso y diálogo abiertos en cada tema.
- Base UI avisa si `Drawer.Popup` no está dentro de `Drawer.Viewport`: corregido en el harness. Para que la prueba de puntero llegue al botón del Drawer hizo falta `Harness.css` (posicionamiento de capas del harness).
- Overlay: la prueba por UI de «abrir Dialog cierra Popover» pasa también con la mutación del coordinador, porque Base UI cierra el Popover por su cuenta (clic/foco fuera). Se añadieron pruebas de reductor puro (G1B-OVERLAY-06/07/08), que sí detectan esa mutación.

## Paso 3c · Gates intermedios

- `npm run typecheck` → 0; `npm run lint` → 0; `npm run test:unit` → 0 (3/3).
- `npm run test:component` → 1 (46 pasan, 3 NumberField fallan).
- `npm run build` → 0; `dist/preview.html` SHA256 `7771a12a42cf510e4feb4e29d1dcd542820c84a553e8fd44e101efe468dab892` (antes `074ca0a0…`; cambio por el arranque extraído a `startApp`, comportamiento verificado por la suite e2e de 1A). Tamaño 1.095.642 B (antes 1.095.561).
- `npm run check:portable` → 0, PASS, 0 peticiones externas, 0 errores.
- `npm run measure:bundle` → 0 (informativo; ratio 1,009).
- `npm run test:e2e` completo ×3 → 0, 0, 0; 12/12 cada vez (5 de 1A, 7 de 1B).

## Paso 3d · Mutaciones de 1B (copias en el scratchpad, `node_modules` enlazado)

| Mutación | Comando | Código | Detectada por |
|---|---|---|---|
| Listener de teclado no retirado en el adaptador | `vitest … -t LIFECYCLE` | 1 | EXTRA-LIFECYCLE-ASYNC (`keydown` neto +40) |
| Reductor conserva Popover al abrir Dialog | `vitest … -t OVERLAY` | 1 | G1B-OVERLAY-06 |
| Adaptador reintenta presentar un aviso fallido | `vitest … -t NOTIFY` | 1 | G1B-NOTIFY-05 |
| Control sin mutar (NOTIFY, OVERLAY, LIFECYCLE) | `vitest … -t "NOTIFY|OVERLAY|LIFECYCLE"` | 0 | todas pasan (`control-mutations-final-filter.log`) |
| Paso 0: cuatro mutaciones (ver arriba) | — | 1 cada una | ver Paso 0 |

Nota: la mutación «Popover no retirado por el coordinador» en la prueba de UI (OVERLAY-02) pasa con y sin ella; la causa es el cierre propio de Base UI, documentado arriba.

## Paso 4 · Gates finales

- Script `evidence/1B/run-gates.sh` (orden y códigos reales) → `evidence/1B/gates-summary-part1.txt`. Auditorías nativas: `evidence/1B/audit-total.audit.json`, `evidence/1B/audit-runtime.audit.json` (códigos 0; 0 hallazgos).
- SHA256 de artefactos y de los fuentes 1B: `evidence/1B/SHA256SUMS.txt`.
- `npm run check:parity` NO se ejecutó: `scripts/check-parity.mjs` no existe (1A, observación 4), y no está en la lista de gates de 1B.

## Paso 5 · Efectos laterales y limpieza

- `npm run test:e2e` (suite completa de 1A y 1B) reescribe `evidence/1A/first-paint/frame-002.png` y `frame-003.png` (captura de 1A). Se restauraron con `git checkout --` tras los gates; no se conservó ninguna captura nueva de 1A. Cualquier nueva ejecución del e2e completo vuelve a tocarlas: hay que restaurarlas tras cada corrida.
- `dist/` y `test-results/` están en `.gitignore`. El harness no aparece en `dist/`.
- Sin commit, push, PR ni cambios en v5, backend ni ui-kit.

## Hallazgos Sonner 2.0.8 (con evidencia)

- **Registro controlado: no hay API.** `Toaster` no recibe la lista; `toast()` escribe en un estado global de módulo. Un `Toaster` nuevo recibe de inmediato los toasts activos (`subscribe` reenvía `getActiveToasts()`). Un id repetido es una actualización. Por eso el store es la fuente de verdad y el adaptador sincroniza con `toast()`/`toast.dismiss(id)`; la prueba de aislamiento limpia con `toast.dismiss()`.
- **Retención:** `duration: Infinity` no cierra por tiempo (G1B-NOTIFY-01: 30 avisos siguen a 400 ms; e2e 30 avisos en Chromium).
- **Expulsión:** no hay límite de pila en el estado; `visibleToasts` (3 por defecto según el código, no ejecutado) decide qué se muestra. Con 1000 se muestran los 30.
- **Suspensión:** no hay prop. Se resuelve con `inert` y `visibility:hidden` en el contenedor, y con presentación diferida desde el adaptador (no se llama a `toast()` mientras está suspendido). G1B-NOTIFY-03 y 03b; e2e.
- **Descarte por teclado:** Sonner restaura el foco al elemento anterior fuera de la lista. La paridad con v5 (foco al cierre siguiente) se consigue en el adaptador con `data-close-button` y `data-testid`, que no son API pública. G1B-NOTIFY-04 y e2e.
- **Brecha 1 (abierta):** el `section` de Sonner tiene `aria-live="polite"` y `aria-relevant="additions text"`. Los avisos se anuncian por Sonner, no por el store; v5 usa `#live`/`#live-error`. No hay prop pública para desactivarlo: hay que decidir entre renderer propio o `toast.custom`.
- **Brecha 2 (abierta):** Escape en v5 cierra el aviso enfocado; en Sonner solo colapsa la pila. No implementado.
- **Atajo Alt+T** de v5: Sonner tiene `hotkey` propio; no probado.

## Decisión de la fase

**STOP (parcial, decisión del dueño).** Motivos: (1) `NumberField` de Base UI 1.9.0 no conserva el texto crudo (tabla del paso 1); la decisión de adaptación o de usar TemporalField la toma el dueño; (2) por eso `npm run test:component` sale con código 1 (3 fallos de NumberField); (3) brechas de Sonner `aria-live` y Escape sin resolver. El resto de la fase (Paso 0, TemporalField, capas, avisos con Sonner en jsdom y Chromium, ciclo de vida, e2e del harness) está verificado en su alcance.

## Paso 6 · Decisiones del dueño D11 y D12 (commit de docs a61762f)

- D11: NumberField REJECTED. Los tres casos G1B-NUMBERFIELD-RAW (`abc`, `1.5`, `1441`) y el bloque NumberField salen de `tests/component/primitive-contract.test.tsx`; no hay `skip`. La evidencia queda en `evidence/1B/numberfield-probe-output.txt` y `numberfield-probe.test.tsx.txt`. TemporalField sustituye a NumberField en minutos y hora.
- D12: Sonner se retira del stack (ver paso 7).

## Paso 7 · Sonner retirado (D12): desinstalación y pruebas RED de la pila propia

- `npm uninstall sonner --ignore-scripts` → código 0 (`uninstall-sonner.log`). Diff: `package.json` solo pierde `"sonner": "2.0.8"`; `package-lock.json` solo pierde las entradas de `sonner` (`package.before.json`, `package-lock.before.json` como referencia).
- Eliminados: `src/notifications/sonner-adapter.ts`, importaciones de sonner en `Harness.tsx`, `Harness.css` y en las pruebas, el CSS de sonner y el trabajo sobre `data-testid`/`data-close-button`.
- RED escrito antes de implementar (`tests/component/primitive-contract.test.tsx`, bloque «pila propia (D12)» G1B-NOTIFY-01…12 y EXTRA-LIFECYCLE-ASYNC de la pila). `NotificationStack` es un stub sin comportamiento (no importa sonner).
- Pruebas nuevas de Escape (G1B-NOTIFY-08), anuncio único y asertivo para error (G1B-NOTIFY-03) y Alt+T (G1B-NOTIFY-09).
- Corrección de prueba durante RED (sin cambiar la expectativa): G1B-NOTIFY-07 usaba `user.click`, que en el navegador enfoca el botón antes de cerrar. Se reescribió como clic disparado (`fireEvent.click`) con un botón ajeno enfocado, que es lo que el contrato «el puntero no mueve foco ajeno» describe.
- RED (stub `NotificationStack`): `evidence/1B/red-notify-d12.log` (11 fallos por aserción o TypeError de elemento ausente).
- GREEN: `src/notifications/notification-store.ts` (sin campos de presentador; añade `announcement`), `NotificationStack.tsx` (renderer propio: #live polite/status, #live-error assertive/alert, región inerte y oculta al suspender, Escape, Alt+T, foco por descarte), `notifications.css` (presupuesto `max-height:min(40dvh,420px)`, `overflow-y:auto`; tokens de producto). Comando: `npx vitest run --project component tests/component/primitive-contract.test.tsx -t "NOTIFY|LIFECYCLE"` → código 0, 14/14 (`green-notify-d12-run2.log`). Dos fallos previos eran de test (aserciones fuera de `act`), corregidos sin cambiar expectativas (`green-notify-d12-run1.log`).

## Paso 8 · Interferencia de e2e con evidencia de 1A (corregida)

- `tests/e2e/offline-theme.spec.ts`: `FIRST_PAINT_DIR` pasa de `evidence/1A/first-paint` a `process.env.FIRST_PAINT_DIR ?? test-results/first-paint`. Aserciones sin cambios (diff de una línea más comentario). Ya no se reescriben archivos versionados de 1A.
- e2e `primitive-contract.spec.ts` tras D12: primera corrida con código 1 por localizador ambiguo (el texto aparece en #live-error y en la pila; correcto). El localizador se acotó a la región «Avisos». Corrida siguiente: `e2e-primitive-d12-run2.log`.

## Paso 9 · API-MATRIX actualizada

- `evidence/1B/API-MATRIX.md`: NumberField REJECTED (D11); Sonner REMOVED (D12); filas nuevas de la pila propia con su evidencia.
- Lint (oxlint, react/set-state-in-effect) marcó setState dentro del cuerpo de un efecto en `NotificationStack`. Corrección: el texto inicial sale del inicializador de `useState` y los cambios llegan por la suscripción al store (`evidence/1B/lint-d12.log` → `lint-d12-2.log`, código 0). Pruebas D12 tras el cambio: código 0, 14/14 (`green-notify-d12-run3.log`).

## Paso 10 · Mutaciones de la pila propia (D12), copia en el scratchpad

| Mutación | Código | Pruebas que fallan |
|---|---|---|
| Escape desactivado en la pila | 1 | 1 (G1B-NOTIFY-08) |
| Errores anunciados en región cortés | 1 | 2 (G1B-NOTIFY-03 y G1B-NOTIFY-04) |
| Región sin `inert` al suspender | 1 | 1 (G1B-NOTIFY-04) |
| Foco robado al llegar un aviso | 1 | 2 (G1B-NOTIFY-07 y G1B-NOTIFY-09) |
| Control sin mutar (NOTIFY y LIFECYCLE) | 0 | 14/14 |

## Paso 11 · Gates finales y decisión

- `evidence/1B/run-gates.sh` → `evidence/1B/gates-summary-final-part1.txt`. Todos con código 0: audit-total, audit-runtime, typecheck, lint, test:unit (3/3), test:component (48/48), build, check:portable (PASS), measure:bundle, test:e2e ×3 (12/12 cada una).
- SHA256 de `dist/preview.html`: 7771a12a42cf510e4feb4e29d1dcd542820c84a553e8fd44e101efe468dab892 (sin cambio respecto al gate intermedio: Sonner no estaba en el bundle).
- Decisión: **READY_FOR_REVIEW** para 1B con el alcance de este informe. Límites: NOT RUN en lista de API-MATRIX, Escape y Alt+T solo en componente (no en navegador), sin lector de pantalla, sin IME, `check:parity` no ejecutado (script inexistente). La revisión independiente la decide el dueño.

## Paso 12 · Foco real en Chromium (encargo de cierre)

- Pruebas nuevas en `tests/e2e/primitive-contract.spec.ts`:
  1. `G1B-OVERLAY · Drawer → Dialog …`: Escape cierra solo el Dialog y el foco queda en el botón «Crear tarea» del Drawer; otro Escape cierra el Drawer y el foco vuelve a «Abrir navegación». Con el Dialog abierto, la pila (`[data-notification-root]`) queda inerte y el Drawer tiene `inert`/`aria-hidden`/marca de Base UI.
  2. `G1B-OVERLAY · Popover de tema no modal …`: Tab sale del Popover; la página no queda inerte (D2: no modal).
  3. `G1B-NOTIFY · Alt+T …`: Alt+T enfoca el cierre del aviso más reciente; Escape con el foco en el aviso intermedio lo cierra y el foco pasa al cierre siguiente.
  4. `G1B-NOTIFY · la llegada de un aviso nuevo no mueve el foco`.
- RED registrado: `red-e2e-focus-final.log`. Falló solo la prueba 1, en «Tab 2 dentro del Dialog»: Base UI pasa por su guardia de foco y devuelve el foco al Dialog. Un diagnóstico (archivo temporal, eliminado) mostró el ciclo entrada → Cerrar → entrada → Cerrar → guardia, y que el foco vuelve dentro. El fallo era de la prueba: no esperaba el foco inicial ni el retorno tras la guardia. Corrección: `expect.poll` para el foco inicial y para el retorno al Dialog; la expectativa (nunca en Drawer ni pila) no cambió.
- Las pruebas 2–4 pasaron a la primera: no hubo cambio de producto. Ningún cambio en `src/`.
- Resultado: `green-e2e-focus-drawer-dialog-3.log` (exit 0).
- API-MATRIX actualizada con los resultados de foco en Chromium (Drawer→Dialog, Popover no modal, Alt+T, Escape en la pila, llegada sin movimiento de foco).
- Gates finales (un pase completo): `evidence/1B/run-gates.sh` → `gates-summary-final-2.txt`, todo código 0. test:e2e ×3: 16/16 cada una (`final-e2e-run1..3.log`). test:component: 48/48 (`final-component.log`).
