# Revisión independiente · Fase 1B (frontend-v6)

Revisor: agente Claude (Sonnet 5.5), distinto del implementador. Fecha: 09/11/2026. Base de comparación: `a61762f`, con cambios sin commit en `prototypes/frontend-v6`. Entorno: Node 24.22.1 (ruta del scratchpad), Chromium de `/opt/pw-browsers/chromium`, un worker. Sin editar producto; mutaciones solo en la copia `.../scratchpad/v6-1b-mutants`. Modos cubiertos: especificación y calidad, ambos sobre el árbol actual. Modo visual: NO ejecutado (no hay capturas propias).

## Veredicto: APPROVE_PHASE (con WARN que se arrastran a 3A y 5A)

Motivo: los gates se reproducen con mis propios códigos (todo 0); las mutaciones pedidas (a–j) se detectan, salvo la variante «trim» de (a); la decisión D11 (TemporalField) y D12 (pila propia, Sonner fuera) están implementadas con evidencia. No hay hallazgo BLOCK. Los WARN son huecos de cobertura o diferencias menores con v5 que no impiden cerrar el harness, pero deben resolverse antes de que 3A/5A cierren filas de paridad. El harness no cierra filas de editor, layout ni pila.

## Hallazgos

| Sev. | Dónde | Evidencia | Esperado / observado |
|---|---|---|---|
| WARN | `src/notifications/NotificationStack.tsx:210-219` (`liveFor`) y `notification-store.ts:183` (`clear`) | Sonda en la copia: `notify('A'); notify('B','error'); clear()` deja `#live-error` = «B». v5 `clear()` vacía ambas regiones (test v5 «clear and modal interruptions cannot revive…» exige `#live` vacío). | `clear()` debe vaciar las regiones vivas. Hoy `liveFor` devuelve `previous` si no hay `announcement`. Ningún test de 1B cubre `clear`. |
| WARN | `NotificationStack.tsx:279-294` (`dismissNotice`) y `notification-store.ts:174` | Sonda: con el foco en el cierre de un aviso, `store.dismiss(id,'keyboard')` y `store.clear()` no llaman al respaldo de foco (0 llamadas; v5 `clear()` hace `restoreFocus()`). El foco solo se gestiona en la ruta de clic/Escape del componente. | La firma del plan `dismiss(id, modality)` ignora `modality` (`dismiss(id)` sin usarla). Si 5A llama al store directo, el foco cae a `body`. Test `G1B-NOTIFY-12` dice «registra la modalidad en el store» pero no comprueba ninguna modalidad. |
| WARN | `OverlayCoordinator.tsx` (`closeTop`) | `closeTop` solo se usa en tests del reductor (grep). En el harness el Escape lo resuelve cada primitiva de Base UI (`onOpenChange`), no el coordinador. | El plan dice «único dueño de capas»: lo es del estado (abrir/cerrar/Dialog retira Popover), no de Escape/Atrás. Aceptable en 1B; 3A debe cablear Escape/Atrás al coordinador y probarlo. Mutación (c) solo se pudo simular en `close`. |
| WARN | `OverlayCoordinator.tsx:112-118` (`resolveReturnFocus`) | Mutante q (quitar `closest('[inert]')`) sobrevive en componente y no hay test que lo ejercite. Tampoco se comprueba «visible» (`hidden`, `display:none`): solo `isConnected` e `inert`. | El brief pide «destino aún visible». Falta test negativo (destino inerte/oculto → respaldo). |
| WARN | `TemporalField.tsx:39` | Mutante a1 (`value.trim()` al escribir) sobrevive: ningún test teclea espacios. v5 conserva el crudo; el dominio valida con trim pero no recorta el borrador. | Añadir caso `"12 "` / `" 12"`: el valor visible debe conservarse tal cual. |
| WARN | `tests/e2e/primitive-contract.spec.ts:37-54`, `Harness.tsx:156,147` | «Alternar banda» y el ancho solo cambian atributos `data-band`; el campo no cambia de contenedor ni de portal entre bandas. El test de nodo idéntico detecta un `key` por banda (mutante b: componente y e2e fallan), pero no un docking real. Selección, caret y undo no están en ningún test. | Sondeo propio en Chromium (copia): selección [0,1] y foco conservados tras 700→999→1000→699, y Ctrl+Z revierte el tecleo (comportamiento correcto), pero no está probado por la suite. Tampoco hay test de raw tras cerrar/reabrir panel ni cambio de tema, que pedía el brief (paso 1). 3A debe probar docking real. |
| WARN | `primitive-contract.test.tsx:183-193` (OVERLAY-05) y `Harness.css` | El harness no define animación ni transición; «cerrar repetidamente durante la animación» se prueba con clic + Escape en jsdom sin animación. | El requisito de cierre durante animación real (Base UI `data-ending-style`) queda sin verificar. Declararlo NOT VERIFIED o añadir CSS de transición al harness. |
| WARN | `primitive-contract.test.tsx` lifecycle | Mutante i3 (suscripción al store sin `unsubscribe` en `NotificationStack`) sobrevive. Los contadores miden `window`/`document` y `matchMedia`, no `store.subscribe`. | El brief y EXTRA-LIFECYCLE-ASYNC piden «suscripciones del store vuelven al valor inicial». Exponer un contador de oyentes del store (solo de prueba) o envolver `subscribe` en el test. |
| WARN | `tests/e2e/primitive-contract.spec.ts:239-243` | «Un solo root de React» comprueba `#root` en el HTML (siempre 1). | Vacío: no cuenta raíces de React. Contar contenedores con clave `__reactContainer$` o un conteo de `createRoot` en el arranque. |
| WARN | `NotificationStack.tsx:250-262` | Mutante k (Alt+T con pila suspendida) sobrevive; `inert` lo hace casi inocuo, pero v5 tiene test explícito. Alt+T ignora además `event.defaultPrevented` e `isComposing` (v5 sí). | Añadir ambos guardas y su test (IME es riesgo real en 4A). |
| SUGGEST | `tests/e2e/primitive-contract.spec.ts:139` | Usa `[data-base-ui-inert]`, atributo privado de Base UI, dentro de una unión con `inert` y `aria-hidden`. | Quitarlo: el selector estándar basta y evita acoplarse a internos. |
| SUGGEST | `tests/e2e/primitive-contract.spec.ts:143-160` | `expect.poll` para el retorno de foco al Dialog: el `forbidden` se evalúa una vez tras cada poll, por lo que un salto transitorio al Drawer no se vería. | No debilita la expectativa (se mantiene «nunca en Drawer ni pila» al estabilizarse), pero sería más fuerte observar `focusin` durante la secuencia. |
| SUGGEST | `NotificationStack.tsx:230,234-247` | `modalityRef` y sus dos oyentes (`keydown`, `pointerdown` en captura) alimentan `dismiss(id, modality)`, que el store ignora. | Código muerto con coste de oyentes; usarlo o quitarlo. |
| SUGGEST | `playwright.config.ts`, `offline-theme.spec.ts:11` | `video:'off'` (falta ffmpeg-1013) y `FIRST_PAINT_DIR` ya no escribe en `evidence/1A`. Ambos documentados en LOG. | No bajan aserciones ni tolerancias. Registrar el motivo de vídeo en el informe de cierre. El e2e de 1A ya no regenera los frames versionados. |

Sin hallazgos en: `any`, `skip/only/todo`, storage/red, Tailwind/router/Radix, tolerancias (`toBeCloseTo` y similares: ninguna), dependencias nuevas. Sonner: ausente de `package.json`, `package-lock.json` y `src`/`tests` (grep sin coincidencias; `node_modules/sonner` no existe tras `npm ci`). El diff de `package.json`/lock solo retira `sonner` (17 líneas del lock).

## Gates (mis ejecuciones, `prototypes/frontend-v6`)

| Gate | Comando | Salida | Log |
|---|---|---|---|
| install | `npm ci --ignore-scripts` | 0 | `review/npm-ci.log` |
| audit-total | `npm audit --include=dev --json` | 0 (0 hallazgos) | `review/audit-total.json` |
| audit-runtime | `npm audit --omit=dev --json` | 0 (0 hallazgos) | `review/audit-runtime.json` |
| typecheck | `npm run typecheck` | 0 | `review/typecheck.log` |
| lint | `npm run lint` | 0 | `review/lint.log` |
| unit | `npm run test:unit` | 0 (3/3) | `review/test-unit.log` |
| component | `npm run test:component` | 0 (48/48, 3 archivos) | `review/test-component.log` |
| build | `npm run build` | 0 | `review/build.log` |
| portable | `npm run check:portable` | 0 (PASS, 0 externas, 0 errores) | `review/portable.log` |
| bundle | `npm run measure:bundle` | 0 (raw 1.086.162 B, gzip 756.192 B, ratio 1,009; informativo) | `review/bundle.log` |
| e2e completo ×3 | `npm run test:e2e` | 0, 0, 0 (16/16 cada una, ~15 s) | `review/e2e-run{1,2,3}.log` |

SHA256 `dist/preview.html`: `7771a12a42cf510e4feb4e29d1dcd542820c84a553e8fd44e101efe468dab892` (coincide con el del implementador; difiere del de 1A `074ca0a0…` por el arranque extraído a `startApp`).
`git status` tras los tres e2e: sin cambios rastreados bajo `prototypes/frontend-v6/evidence/1A` (el cambio de `FIRST_PAINT_DIR` lo evita). El harness no está en `dist/preview.html` (ni `harness`, `OverlayCoordinator`, `NotificationStack`, `TemporalField`; `vite` solo empaqueta `preview.html`); la suite offline-theme de 1A y `check:portable` pasan sin cambios de aserción. Cambios en `main.tsx`: solo delega en `startApp`.

## Revisión de especificación (PLAN 1B, D2/D3/D11/D12)

- Capas: Drawer→Popover y Drawer→Dialog, Dialog retira el Popover (reductor, OVERLAY-06; mutante p detectado), Escape cierra solo la capa superior (OVERLAY-01, e2e), foco de retorno al control del Drawer y luego al disparador (e2e real), inerte bajo modal (pila y Drawer), Tab sale del Popover no modal, 20 aperturas/cierres sin capas huérfanas en jsdom. Lagunas: ver WARN de Escape no cableado, `resolveReturnFocus` y animación.
- TemporalField: texto crudo exacto (`abc`, `-1`, `1.5`, `1441`), mensajes idénticos a `v5/src/validation.mjs`, sin clamp, vacío ≠ 0, 999/1000 sin cambios. Un nodo DOM en 699↔700/999↔1000 (e2e con referencia al nodo). Selección y undo: correctos en mi sondeo, sin test.
- Tema/tokens: e2e mide `--canvas` y contraste ≥ 4.5:1 en Popover, aviso y Dialog (portales a `body`) en Oscuro/Claro/Sistema. «Sistema» solo se prueba con el esquema emulado claro.
- Un root: ver WARN (comprobación vacía). Ciclos: 20 ciclos con StrictMode, Drawer y Dialog devuelven `keydown`/`pointerdown`/`selectionchange`/`matchMedia` a base; faltan las suscripciones del store.
- Avisos: región cortés (`role=status`) y asertiva (`role=alert`) separadas, un único anuncio por aviso (mutante e detectado), 30 avisos con 15 errores sin expulsión (mutante f detectado), suspensión inerte/oculta y anuncio diferido (mutantes g y l detectados), descarte por teclado siguiente→anterior→respaldo (h, n detectados), puntero no mueve foco ajeno (o detectado), Escape solo en el aviso enfocado, Alt+T, texto literal, `notify('')` devuelve `''`. Sonner removido y justificado (D12).

### Diferencias de la pila frente a los tests de v5

| Test v5 | En 1B |
|---|---|
| retención, severidad, lista no viva | Igual (G1B-NOTIFY-01/03). |
| duplicados reutilizan nodo + «Repetido N veces» | Igual en contador y texto; el id repetido se devuelve (NOTIFY-02), el anuncio con contador lo verifiqué en sonda P6. |
| texto no es HTML | Igual (NOTIFY-10). |
| no roba foco y persiste | Igual (e2e «llegada no mueve foco»). Sin salida por tiempo. |
| cierre intermedio → cierre siguiente; último → anterior; sin avisos → respaldo | Igual (NOTIFY-05/06 + e2e). |
| cierre sin foco no mueve foco ajeno | Igual (NOTIFY-07, con `fireEvent.click`). |
| descarte por puntero inert + salida de 300 ms; repetir durante salida revierte; FLIP; reduced-motion; settle por tecla | NO portado (sin animación; planeado para 5A/6A). Sin estado `closing`. |
| Alt+T / Escape solo dentro de la pila | Igual. Faltan guardas `defaultPrevented`/`isComposing` y Alt+T bajo suspensión (WARN). |
| suspensión: `inert`, `aria-hidden`, `data-suspended`, anuncio diferido | `inert` + `visibility:hidden` + anuncio diferido; no hay `aria-hidden` ni `data-suspended`. Solo se difiere el último anuncio (v5 igual). |
| `clear()` y suspensión no reviven avisos; vacía `#live` | Diferente: `clear()` deja texto viejo en la región viva (WARN). |
| scroll de lectura / seguir al último | NO portado (sin test). |
| botón «Limpiar» y contador | NO portado. |
| descartar el último anunciado limpia el texto vivo | Igual (sonda P5). |
| presupuesto de CSS (`max-height:min(40dvh,420px)`; `overflow-y:auto`) | Igual (NOTIFY-01). |

## Mutaciones (copia en scratchpad; ejecuciones en `review/mutants/summary.txt`)

| Mutante | Prueba que falla | Resultado |
|---|---|---|
| a1 TemporalField recorta (`trim`) | ninguna | SOBREVIVE |
| a2 TemporalField normaliza (solo `0-9:`) | TEMPORAL-RAW abc/-1/1.5 + NATIVE-EDIT | detectado |
| a3 TemporalField acota a 1440 | TEMPORAL-RAW 1441, 999/1000 | detectado |
| a4 vacío → «0» | TEMPORAL-RAW 0/vacío | detectado |
| b remonta por banda 700 (`key`) | NATIVE-EDIT (componente) y e2e 699↔700 | detectado |
| b2 remonta por banda 1000 | NATIVE-EDIT | detectado |
| c `close` borra todas las capas (Escape cierra todo) | OVERLAY-01/02 (componente), e2e Escape y Drawer→Dialog | detectado |
| d sin restaurar foco al cerrar Dialog | OVERLAY-02, e2e Drawer→Dialog | detectado |
| e errores en región cortés | NOTIFY-03/04 | detectado |
| f expulsar el más antiguo con >20 | NOTIFY-01 | detectado |
| g suspensión sin diferir anuncio | NOTIFY-04 | detectado |
| h descarte por teclado deja el foco en `body` | NOTIFY-05/06, e2e Alt+T y descarte | detectado |
| i1 fuga de `keydown` (Alt+T) | LIFECYCLE ×2 | detectado |
| i2 fuga de `matchMedia` | LIFECYCLE StrictMode | detectado |
| i3 fuga de suscripción al store | ninguna | SOBREVIVE |
| i4 fuga de `pointerdown` | LIFECYCLE ×2 | detectado |
| j sin StrictMode en `startApp` | EXTRA-STRICTMODE-HOME | detectado |
| k Alt+T con pila suspendida | ninguna | SOBREVIVE |
| l pila sin `inert` al suspender | NOTIFY-04 | detectado |
| n `key` inestable en avisos | NOTIFY-05/06 | detectado |
| o descarte siempre mueve el foco | NOTIFY-07 | detectado |
| p Dialog no retira el Popover (reductor) | OVERLAY-06 | detectado |
| q retorno de foco ignora `inert` | ninguna | SOBREVIVE |

Control sin mutar: 48/48. Sondas de comportamiento adicionales (no mutaciones, ver hallazgos): P1 clear deja región viva, P3/P4 foco no restaurado por store, resto verde.

## Calidad de los cambios de prueba durante GREEN (LOG 3b, 6–10, `expect.poll`)

- No hay expectativa debilitada, `skip` ni tolerancia ampliada. Sí hay cambios de forma justificados:
  - Retiro de los 3 tests de NumberField (paso 6): decisión D11 del dueño; evidencia conservada en `numberfield-probe-output.txt`; los mismos casos (`abc`, `-1`, `1.5`, `1441`, vacío, `0`) pasan a TemporalField.
  - NOTIFY-07 de `user.click` a `fireEvent.click`: el escenario «foco ajeno» no existe con clic real (el navegador enfoca el botón); la expectativa se mantiene y el mutante o la detecta. El caso de clic real en Chromium no está en e2e.
  - Calentamiento en el ciclo con StrictMode: excluye el `selectionchange` de user-event; una fuga de 1 por ciclo seguiría detectándose (i1, i4 lo prueban).
  - Contraste e2e reescrito para medir con las capas abiertas: refuerza.
  - OVERLAY-06/07/08 de reductor puro añadidos porque la prueba de UI no distingue el cierre del Popover por Base UI: refuerza (mutante p).
  - `expect.poll` en foco del Dialog: ver SUGGEST (más débil en transitorios, no cambia el contrato final).
  - `FIRST_PAINT_DIR` en `offline-theme.spec.ts`: no toca aserciones.
- Cobertura que sigue débil: mutantes a1, i3, k, q (arriba).

## Calidad de código

Dominio/estado/UI separados (store sin DOM; pila solo pinta; coordinador con reductor puro). Sin storage ni red; sin `any`; sin Tailwind, router ni Radix; sin dependencias nuevas; `dist` limpio de harness. Uso de API pública de Base UI salvo `data-base-ui-inert` en un test (SUGGEST). Efectos con limpieza y StrictMode ejercitado.

## NOT VERIFIED

Lector de pantalla (NVDA/JAWS/VoiceOver) y anuncio real de `role=status/alert`; IME y composición; Firefox y WebKit (solo Chromium; `test:smoke:engines` no ejecutado); dispositivo táctil y gestos de Drawer; animaciones reales y reduced-motion (no existen en el harness); host ChatGPT/iframe/CSP; modo visual (sin capturas propias de píxeles); `check:parity` (el script no existe); Back/Atrás del navegador sobre capas (2B/3A); posicionamiento y colisiones del Popover; Tabs, Collapsible, Checkbox, Select y AlertDialog (NOT RUN en API-MATRIX); comportamiento de NumberField más allá de la sonda archivada.

## Siguiente paso

Quien decide es el dueño. Recomendación: aprobar 1B y registrar los WARN como condiciones de entrada de 3A (docking real, Escape/Atrás por coordinador, foco visible) y 5A (`clear`, foco desde el store, guardas IME, suscripciones del store).
