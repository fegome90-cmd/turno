# Encargo de la fase 1B · implementador

Fecha: 09/11/2026. Autorización: orden del dueño «Continúa» tras G1A aprobado (`90b1c6b`), con el mismo reparto «orquestas, haiku ejecuta y sonnet testea». Alcance: solo 1B. Sin push, PR ni fase 2A.

## Lee completo antes de escribir

1. `docs/migration-v6/agent-contracts/prompts/00-contract.md` y `10-implementer.md`.
2. `docs/migration-v6/PLAN.md`: «Global Constraints» y «Fase 1B» completa (interfaces `OverlayLayer`/`OverlayState` y API de notificaciones exactas).
3. `docs/migration-v6/REACT_RESEARCH.md` fila «1B / G1B» y `EXECUTION_LESSONS.md` secciones EXTRA-LIFECYCLE-ASYNC y EXTRA-NATIVE-EDIT.
4. `docs/migration-v6/phase-1a/EXECUTION-1A.md` (observaciones abiertas) y `prototypes/frontend-v6/evidence/1A/review/REVIEW-1A.md`.
5. Fuentes v5 de referencia (solo lectura): `src/validation.mjs` (estimación: minutos enteros 0–1440, mensaje exacto), `src/toasts.mjs` y `tests/toasts.test.mjs` (pila larga sin expulsar errores, suspensión modal, cierre por teclado/puntero, foco al cerrar), `src/app.mjs` (umbrales 700/1000 px, drawers, Escape/Atrás), `docs/VIEWPORT.md`.
6. APIs: lee los tipos publicados en `node_modules/@base-ui/react` y `node_modules/sonner` (versiones fijadas 1.9.0 y 2.0.8). No uses documentación de otra versión ni selectores internos.

## Entorno

Igual que 1A: repositorio `/home/user/turno`, rama `claude/confident-galileo-rahzv6`, base `dd30d7b`; trabaja solo en `prototypes/frontend-v6/**`. En cada comando: `export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH`. Chromium en `/opt/pw-browsers/chromium` (ya configurado), nunca `playwright install`. Un worker. No añadas dependencias: todo lo necesario ya está en el lock; si algo falta, STOP.

## Paso 0 · Cerrar la observación 1 de 1A (antes de 1B)

Hoy ninguna prueba ejecuta `main.tsx`. Extrae el arranque a `src/app/bootstrap.tsx` con `startApp(container, {random})` (crea la sesión fuera del árbol, monta `<StrictMode>` y devuelve `unmount`); `main.tsx` solo llama a `startApp(document.getElementById('root'), {random: Math.random})`. Prueba `tests/component/bootstrap.test.tsx` con ID `EXTRA-STRICTMODE-HOME` que monte con `startApp` y demuestre: `random` llamado exactamente 1 vez; StrictMode activo (detecta su doble invocación de efectos en desarrollo con un sondeo de prueba, sin tocar el producto); desmontar y montar otra vez crea una sesión nueva. Debe fallar con estas mutaciones (compruébalas en una copia y registra el resultado): Math.random descartado dentro de Home; `createSession` dentro de un componente; quitar StrictMode. Además, una prueba de componente que falle si se elimina el script inline de tema de `preview.html` (observación 2), leyendo el HTML fuente.

## Lo que prueba 1B (harness técnico, no pantalla del producto)

Archivos del PLAN: `src/components/TemporalField.tsx`, `src/components/OverlayCoordinator.tsx`, `src/notifications/{notification-store,sonner-adapter}.ts`, `src/notifications/NotificationStack.tsx`, `tests/component/primitive-contract.test.tsx`, `tests/e2e/primitive-contract.spec.ts`. El harness vive en `tests/` o en una entrada HTML de prueba aparte (`harness.html`, no incluida en `dist/preview.html`); documenta cuál. `dist/preview.html` no debe cambiar de comportamiento.

Cada caso lleva su ID en el nombre: `G1B-…` para contratos del plan, `EXTRA-LIFECYCLE-ASYNC` y `EXTRA-NATIVE-EDIT` para esos controles.

1. **NumberField primero (decide antes de lo demás).** Con `NumberField` de Base UI 1.9.0 escribe `abc`, `-1`, `1.5`, `1441`, vacío y `0`; luego blur, cerrar/reabrir el panel que lo contiene, cambiar tema y cruzar 999↔1000. Exige: texto crudo exacto conservado, error con el mensaje v5, sin clamp, vacío no se vuelve 0, selección intacta si no cambió el valor. Haz lo mismo con `TemporalField` basado en `Field` + `<input type="text">` validado por una función pura de prueba que replique la regla v5. Si NumberField normaliza o descarta el texto crudo, registra el caso exacto, **no lo arregles por dentro** y continúa usando TemporalField; la decisión final la toma el dueño (STOP parcial en ese punto del reporte).
2. **Capas.** `OverlayCoordinator` como única autoridad: Drawer (navegación) → Popover (tema, no modal) y Drawer → Dialog. Abrir Dialog cierra el Popover; Escape cierra solo la capa superior; el foco vuelve a un destino aún visible; con Dialog abierto, el resto es inert/no accesible; Tab sale del Popover de tema. Cerrar repetidamente durante la animación no deja capas huérfanas.
3. **Edición nativa y docking (EXTRA-NATIVE-EDIT).** Un editor de prueba con título largo y estimación inválida dentro de un layout que cambia en 699↔700 y 999↔1000: una sola instancia de cada campo (sin remontar: mismo nodo DOM), caret/selección, texto crudo, errores y undo conservados; portales no duplican controles. Tema claro/oscuro/sistema con Dialog, Popover y avisos abiertos en portal a `body`: tokens calculados correctos y contraste ≥ 4.5:1 del texto principal; un solo root de React.
4. **Avisos.** `notification-store` es la fuente de verdad; `sonner-adapter` solo presenta. 30 avisos de estado + errores: ningún error expulsado; `setSuspended(true)` (modal abierto) oculta/vuelve inert la pila y difiere el anuncio; `dismiss(id,'keyboard')` mueve el foco al siguiente cierre como v5; un fallo al notificar no produce un «guardado» exitoso. Determina con evidencia si Sonner 2.0.8 acepta registro controlado, suspensión y retención (sin límite que expulse). Si no, documenta la brecha y si `toast.custom`/renderer propio la cierra; no la escondas.
5. **Ciclo de vida (EXTRA-LIFECYCLE-ASYNC).** 20 ciclos montar/desmontar del harness (más StrictMode): listeners de `matchMedia`, `keydown`, `popstate`, `resize` y suscripciones del store vuelven al valor inicial; ninguna operación duplicada.

## Pasos y evidencia (`prototypes/frontend-v6/evidence/1B/LOG.md`, comando + código + resumen por paso)

1. Paso 0 con RED/GREEN y mutaciones.
2. Pruebas 1B escritas primero: `npm run test:component -- primitive-contract` y `npm run test:e2e -- primitive-contract.spec.ts` deben FALLAR por aserción (`red-*.log`).
3. Implementa el mínimo con APIs públicas. GREEN (`green-*.log`).
4. Gates completos: `npm audit` total y runtime (0 y código 0), typecheck, lint, `test:unit`, `test:component` (todo), build, `check:portable`, `test:e2e` (todo) 3 veces seguidas, `sha256sum dist/preview.html`.
5. `evidence/1B/API-MATRIX.md`: tabla API → necesidad → evidencia (prueba) → resultado → adaptación pendiente, para Drawer, Popover, Dialog/AlertDialog, Field, NumberField, Tabs, Collapsible, Checkbox, Select y Sonner. Lo no probado en 1B se marca NOT RUN.
6. No hagas commit. Reporte común: READY_FOR_REVIEW o STOP, con cada gate (comando, código, artefacto, SHA256) y las desviaciones.

## Prohibido

Lo mismo que 1A: editar fuera de `prototypes/frontend-v6/`; tocar v5; `skip`, borrar aserciones, subir tolerancias; dependencias nuevas, `--force`, overrides; storage o red en el producto; parchear internos de Base UI o Sonner; marcar filas de paridad como cerradas (el harness no cierra filas de editor, layout ni pila); inventar evidencia.
