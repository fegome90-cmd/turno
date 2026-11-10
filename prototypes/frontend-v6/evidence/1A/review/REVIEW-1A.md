# Revisión independiente · Fase 1A (frontend-v6)

Revisor: agente independiente (modo especificación + calidad; no se hizo modo visual). Fecha: 08/11/2026. Árbol: `prototypes/frontend-v6` sin commit (base `da55def`, v5 de referencia solo lectura). Node 24.22.1, npm 11.19.1, Chromium `/opt/pw-browsers/chromium`, un worker. No se editó ningún archivo de producto.

## Veredicto: APPROVE_PHASE (con 4 WARN que no bloquean 1A)

Los siete requisitos están cubiertos por pruebas con los oráculos de v5, los tokens y los activos son idénticos byte a byte, todos los gates se repitieron con código 0 y el artefacto se reconstruyó con el mismo SHA256 que declara el implementador. El control EXTRA-STRICTMODE-HOME queda **parcialmente** probado (WARN-1) y debe reforzarse antes de que la fase 1B dependa de él. El cambio de oráculo del primer paint es defendible y la mutación (e) demuestra que sigue detectando un destello claro real. Nada de lo hallado exige STOP.

## Hallazgos

| # | Sev. | Ubicación | Evidencia | Qué hacer |
|---|---|---|---|---|
| 1 | WARN | `tests/component/theme-home.test.tsx:211-229`; `src/main.tsx:10-25` | EXTRA-STRICTMODE-HOME: el test llama él mismo a `createSession` y pasa el subtítulo por props, así que nunca ejecuta `main.tsx`. Sobrevivieron a toda la batería (unit, component, e2e): (d3) `Math.random()` descartado dentro del render de `Home`; (d4) `createSession()` movido a un componente `App` dentro de `<StrictMode>`; (l) quitar `StrictMode` de `main.tsx`. Que `createSession` sea único y externo al árbol solo lo acredita la lectura del código. (d2, sorteo con `Math.random` en `Home`) solo cae de forma probabilística: 5 de 6 ejecuciones lo detectaron, porque el texto esperado coincidía 1 de cada 4 veces. | Añadir una prueba que importe/ejecute el bootstrap real (o una comprobación estática de que `main.tsx` envuelve en `StrictMode` y que `createSession` está a nivel de módulo) y que espíe `Math.random` durante el render de `Home`. Antes de 1B. |
| 2 | WARN | `tests/e2e/offline-theme.spec.ts:101-105, 134-170` | EXTRA-OFFLINE-FIRST-PAINT descansa en un solo test (capturas). Con el script inline de `preview.html` eliminado (mutación e), los tests 1-2, incluido el observador de paint (`data-theme` en la primera entrada), **pasan**: React fija `data-theme` antes del primer paint en `file://`. Solo el test 4 de capturas lo detecta (5/5, canal 255). Es decir, el observador de paint no discrimina el bootstrap inline. | No es un defecto del producto. Dejar constancia de que la prueba de capturas es la única barrera y no relajar su umbral (≤64) ni su protocolo. |
| 3 | WARN | `tests/e2e/offline-theme.spec.ts:145-149`; LOG.md «Orquestador» | Cambio de oráculo posterior a resultados, con diagnóstico basado en hipótesis. Mis pruebas: 30/30 corridas con `about:blank` previo y 30/30 con documento oscuro previo no dieron ningún frame claro tras el commit (`fp-blank-30.json`, `fp-dark-30.json`). Es decir, **no reproduje** los dos frames blancos del implementador, ni confirmé la causa. Ver apartado 4. | Aceptable. Mantener la nota de que la causa del blanco con `about:blank` no está demostrada. |
| 4 | WARN | `package.json` (script `check:parity`) | Apunta a `scripts/check-parity.mjs`, que no existe. No lo ejecuté. El brief no lo pide para 1A, pero el script queda declarado y roto hasta que se cree. | Crear el script en su fase o marcarlo explícitamente como pendiente. |
| 5 | SUGGEST | `tests/e2e/offline-theme.spec.ts:97` | Solo se calcula `--solid` en el navegador; `--on-solid` se comprueba únicamente por regex sobre `tokens.css` (mismo oráculo que v5). | Añadir `--on-solid` calculado a la sonda e2e. |
| 6 | SUGGEST | `tsconfig.json` | `skipLibCheck: true`. El plan pide no ocultar errores de tipos; aquí solo afecta a `.d.ts` de terceros. | Valorar quitarlo cuando el árbol de tipos lo permita. |
| 7 | SUGGEST | `package.json` | `@base-ui/react`, `zustand`, `sonner`, `lucide-react` y `clsx` están instalados, fijados y sin uso en `src` (conforme al brief; pesan en el lock y la auditoría, no en el bundle). | Sin acción; revisar en 1B. |
| 8 | SUGGEST | `evidence/1A/first-paint/`, `dist/`, `test-results/` | Al ejecutar los gates exigidos, el e2e reescribió `evidence/1A/first-paint/` y `test-results/`, y `npm run build` regeneró `dist/` (mismo SHA). | Informativo. |

Comprobado sin hallazgo: React 19.3.1 con `StrictMode` activo en `main.tsx`; cero `localStorage`/`sessionStorage`/`fetch`/XHR/WebSocket/cookie en `src`; sin Tailwind, router ni Radix en manifiesto o lock; sin `any`, `skip`, `.only`, `@ts-ignore` ni `oxlint-disable`; versiones sin `^` ni `~`; `engines` y `.node-version` correctos; `.oxlintrc.json` exacto al brief; scripts iguales a la tabla del PLAN; tolerancias no subidas; `ThemeProvider` limpia su listener y deriva `effective` sin segundo dueño de estado; `Home` no sortea; `createSession` está a nivel de módulo, fuera del árbol, en `main.tsx`.

## 1. Gates (ejecutados por mí, desde `prototypes/frontend-v6`)

Logs y códigos en `evidence/1A/review/`.

| Gate | Comando | Código | Resultado | Log |
|---|---|---|---|---|
| Instalación limpia | `npm ci --ignore-scripts` | 0 | 0 vulnerabilidades reportadas | `npm-ci.log` |
| audit-total | `npm audit --include=dev --json` | 0 | info/low/moderate/high/critical/total = 0 | `audit-total.json` |
| audit-runtime | `npm audit --omit=dev --json` | 0 | todo 0 | `audit-runtime.json` |
| typecheck | `npm run typecheck` | 0 | PASS | `typecheck.log` |
| lint | `npm run lint` | 0 | PASS | `lint.log` |
| unit | `npm run test:unit` | 0 | 3/3 | `test-unit.log` |
| component | `npm run test:component` | 0 | 12/12 | `test-component.log` |
| build | `npm run build` | 0 | `dist/preview.html` 1.095.561 bytes | `build.log` |
| check:portable | `npm run check:portable` | 0 | PASS, 0 peticiones externas, 0 errores | `portable.log` |
| measure:bundle | `npm run measure:bundle` | 0 | 1.095.561 B brutos / 725.861 gzip; v5 1.086.162 / 756.192; ratio bruto 1,009, sin aviso (informativo) | `bundle.log` |
| e2e `offline-theme.spec.ts` ×3 | `npm run test:e2e -- offline-theme.spec.ts` | 0, 0, 0 | 5/5 en cada ejecución | `e2e-run1..3.log` |
| Extra: test de primer paint ×12 | `playwright test -g FIRST-PAINT` | 12 pasan | 12/12 (15/15 con las tres anteriores) | `fp-repeat-*.log` |

**SHA256 de `dist/preview.html`:** `074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4`. Coincide con el declarado por el implementador (`dist.sha`, `pre-existing-dist.sha`); la reconstrucción desde una instalación limpia es reproducible.

No re-ejecuté `perf-shell` (informativo, sin umbral) ni `check:parity`.

## 2. Revisión de especificación

| ID | Oráculo v5 | Prueba v6 | Estado |
|---|---|---|---|
| HOME-SUBTITLE-01 | `home-subtitle.test.mjs` catálogo, congelado, sin «Demo» ni `<` | `tests/unit/home-subtitle.test.ts` | Equivalente; mutación (a) cae |
| HOME-SUBTITLE-02 | `(i+.5)/4` y una sola llamada | idem | Equivalente (más un `toHaveLength(4)` contra vacío) |
| HOME-SUBTITLE-03 | `-1`, `1`, `NaN` | idem, más `Infinity`, `0`, `2` | Equivalente o más estricto; mutación (b) cae |
| DESIGN-COMPLETE-01 | `design-complete` «theme defaults to system…» | `theme-home.test.tsx`, cinco casos | Cubre defecto `system`, seguimiento, elección explícita, valor inválido y vuelta a `system`. Se omite `changes.length>=4` de v5, que usaba un `onChange` que la interfaz v6 no tiene; no es una pérdida de comportamiento. Mutaciones (j) y (k) caen |
| DESIGN-COMPLETE-02 | «no matchMedia still gives a usable explicit dark mode» | un caso | Equivalente |
| TOKENS-01 | `tokens.test.mjs`, mismas dos regex | un caso sobre `src/styles/tokens.css`, más `--solid` calculado en e2e para ambos temas | Mutación (f) cae. Ver SUGGEST 5 |
| UI-01 | `ui.test.mjs` «home has greeting…» | `Hola, Demo.` / `Hola.`, un botón en `main`, `onOpenShift` llamado una vez, cero `input`; más e2e | Equivalente; mutación (g) cae |
| EXTRA-STRICTMODE-HOME | n/a | componente | **Parcial** (WARN-1) |
| EXTRA-THEME-NO-STORAGE | n/a | componente (espías de `setItem` y `fetch`, con comprobación positiva previa) y e2e (`storage` vacío) | Mutación (c) cae |
| EXTRA-OFFLINE-FIRST-PAINT | n/a | e2e, capturas | Cubierto por una sola prueba (WARN-2); mutación (e) cae |
| EXTRA-OFFLINE-ARTIFACT | n/a | e2e `file://` y HTTP, red externa bloqueada, recarga que vuelve a `system`; `check:portable` | Cubierto; mutación (h) cae |
| EXTRA-PERFORMANCE-FLOWS | n/a | `perf-shell.json`, criterio fijado antes de medir | Solo informativo; no cierra la fila (7A) |

**Tokens:** `src/styles/tokens.css` es idéntico, línea a línea, a las líneas 7-8 de `frontend-v5/src/styles.css`. Los 69 tokens de `:root` y del bloque oscuro coinciden; **no falta ni cambia ninguno**. Los `@font-face` y las reglas de `global.css` copiadas coinciden con v5. Adición documentada: `html{background:var(--canvas)}`, ausente en v5.

**Activos (sha256):** las 5 fuentes `.woff2`, `play.svg` y las 3 licencias (SourceSans3-OFL, SourceSerifPro-OFL, Lucide-LICENSE) son idénticas a v5. Solo se copió 1 de los 34 iconos de v5 (`play.svg`), el que usa Inicio.

**Identidades fuera de 1A:** no se revisaron las otras 205 filas de la matriz; 1A no declara cerrarlas y no encontré indicios de que las toque.

## 3. Mutaciones (copias en `…/scratchpad/v6-mutants/`; salidas en `mut-*.log`)

| Mut. | Cambio | Prueba ejecutada | Resultado |
|---|---|---|---|
| a | Cambiar la frase «¿Por dónde empezamos?» | `test:unit` | **Caída**: HOME-SUBTITLE-01 |
| b | `chooseHomeSubtitle` devuelve `undefined` ante `NaN` | `test:unit` | **Caída**: HOME-SUBTITLE-03 |
| c | `ThemeProvider` escribe `localStorage.setItem` | `test:component` | **Caída**: EXTRA-THEME-NO-STORAGE (4 llamadas) |
| d1 | `createSession` llama dos veces a `random` | `test:component` | **Caída**: EXTRA-STRICTMODE-HOME |
| d2 | `Home` sortea con `Math.random` en el render | `test:component` ×7 | **Caída** en 6 de 7 ejecuciones (EXTRA-STRICTMODE-HOME y HOME-SUBTITLE-02); detección probabilística, no por conteo de llamadas |
| d3 | `Math.random()` descartado en el render de `Home` | `test:component` | **SOBREVIVE** (12/12) |
| d4 | `createSession()` dentro de un componente bajo `StrictMode` | `test:unit` y `test:component` | **SOBREVIVE** (3/3 y 12/12); `tsc` pasa |
| e | Eliminar el script inline de tema de `preview.html`, reconstruir | `test:e2e` ×5 | **Caída 5/5** en el test de capturas (canal 255); los tests 1-2 pasan |
| f | `--solid` oscuro `#f2f3f0` → `#f2f3f1` | `test:component` | **Caída**: TOKENS-01 |
| g | `<input>` en `Home` | `test:component` | **Caída**: UI-01 |
| h | `<img src="https://example.com/x.png">` | `build` + `check:portable` | **Caída**: código 1, `static-attribute`, 2 peticiones externas, 1 error de consola |
| j | Quitar el listener de `matchMedia` | `test:component` | **Caída** (3 casos) |
| k | Quitar la validación de valores de `setPreference` | `test:component` | **Caída**: DESIGN-COMPLETE-01 |
| l | Quitar `StrictMode` de `main.tsx` | `test:unit` y `test:component` | **SOBREVIVE** (WARN-1) |

Mutaciones del encargo: a-h, 8 de 8 detectadas (d solo en una de sus variantes con certeza; d3 y d4 sobreviven). Extras j, k y l: j y k caen, l sobrevive.

## 4. Cambio del oráculo de primer paint

**Qué cambió:** el test navega primero a un `data:` oscuro (`#171817`) en vez de `about:blank`, exige que **todos** los frames capturados sean oscuros (canal máximo ≤64, umbral que ya existía) y que el último sea exactamente `#171817`, y elimina la clasificación de frames por marca de tiempo.

**Mi opinión: la justificación es válida, con reservas.**
- El criterio anterior comparaba relojes de dos procesos distintos (marca del frame frente a hora de commit), lo cual no es fiable. Quitarlo es correcto.
- Con un documento previo claro, el blanco que Chromium mantiene hasta pintar el documento nuevo no es un paint de Turno. Con un previo oscuro, cualquier frame claro solo puede venir del artefacto; el oráculo mide exactamente lo que es responsabilidad del producto.
- **Sensibilidad demostrada:** la mutación (e) (sin script inline) produce un frame blanco (255) y el test falla 5 de 5. El oráculo no se volvió ciego. Sobre el artefacto real, 15/15 pasan (3 del spec y 12 míos), más 30/30 mis corridas con el script de repetición.
- **Reservas:** (1) es un cambio posterior a un resultado discrepante; el contrato exige conservar ambos resultados, y el LOG los conserva. (2) Yo no pude reproducir el blanco con `about:blank` (0 de 30), así que la hipótesis del lienzo previo sigue sin estar demostrada; los 2 de 10 del implementador quedan como observación no explicada. (3) El protocolo no cubre el estado real de un usuario que abre el archivo desde una pestaña blanca ni el iframe del host; esa superficie no es de Turno, pero tampoco está medida. (4) Solo 3-4 frames por corrida: un destello de menos de un frame podría escapar; el control mutante sugiere que no ocurre con el mecanismo probado.

Recomendación: aceptar el cambio y no tocar más el umbral ni el protocolo sin nueva revisión.

## 5. Calidad de código

Separación correcta: dominio (`home-subtitle.ts`), estado de tema (`theme-provider.tsx`), UI presentacional (`Home.tsx`), sesión (`create-session.ts`) y bootstrap (`main.tsx`). El tema tiene un solo dueño; el script inline de `preview.html` y `ThemeProvider` escriben los mismos atributos de forma coherente. `useLayoutEffect` fija el DOM antes de pintar; el listener se limpia y tiene rama para `addListener`. Sin red ni almacenamiento. El proyecto declara `engines`, fija el lock y audita en cero. Debilidad principal de calidad: la verificación de que la sesión está fuera del árbol (WARN-1).

## 6. NO verificado

- Firefox y WebKit (no instalados; sin smoke de motores).
- Dispositivos reales, pantallas táctiles, rendimiento en móvil.
- Lectores de pantalla y tecnologías de apoyo; foco y contraste reales (el CSS de Inicio no se inspeccionó en píxeles).
- Host ChatGPT/iframe y recarga con servidor caído (no se promete).
- Revisión visual (modo visual): no se inspeccionaron capturas a 1440×900 ni 390×844; el único dato de píxeles es el de las capturas del test de primer paint.
- Comportamiento de `StrictMode` en `vite dev` (los tests lo cubren solo en JSDOM; el build de producción no duplica efectos).
- `check:parity`, las 205 filas restantes de la matriz y el criterio de rendimiento comparativo (7A).
- Que los 2 frames blancos del implementador fueran un artefacto del arnés: hipótesis, no reproducida.
- Aceptación humana del cambio de oráculo: este informe es una opinión técnica, no una aprobación del dueño.

## Siguiente paso

Decide el orquestador/dueño: pasar a 1B con el árbol revisado. Condición recomendada: cerrar WARN-1 (prueba real de bootstrap y `StrictMode`) al inicio de 1B, porque EXTRA-STRICTMODE-HOME gobierna 2A, 2B y 4A. Cualquier cambio de producto posterior invalida esta revisión para el nuevo árbol.
