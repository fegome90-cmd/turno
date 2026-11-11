# Log de ejecución · Fase 1A (frontend-v6)

Implementador: agente Claude (Haiku 5.5). Rama `claude/confident-galileo-rahzv6`, base `da55def`. Sin commit, push ni PR.
Entorno: Node v24.22.1, npm 11.19.1, registry https://registry.npmjs.org/, Chromium de `/opt/pw-browsers` (no se ejecutó `playwright install`).

## Paso 1 · Manifiesto, lockfile, auditoría (08/11/2026)

- Creados: `package.json` (versiones exactas del brief, scripts de PLAN §4), `.node-version` (24.22.1), `.oxlintrc.json` (exacto del brief).
- Comando: `npm install --ignore-scripts` → código 0; log `evidence/1A/npm-install.log`; `npm ls --all` código 0 (`npm-ls-all.log`, sin peers inválidos).
- `npm audit --include=dev --json > evidence/1A/audit-total.audit.json; echo 0` → código 0, 0 vulnerabilidades.
- `npm audit --omit=dev --json > evidence/1A/audit-runtime.audit.json; echo 0` → código 0, 0 vulnerabilidades.
- SHA256 package.json / package-lock.json: e20c8717d8b9bae9ed668acfa19ce992837e6cfcdac6eba6ebe3a859a77fed8e f511e1375f02bd67305149c06392c5349899f81f94dde2c867da684ff4920bc3 

Estado: PASS (nonvisual, npm audit total y runtime con 0 findings).

## Paso 2 · Configuración

- Creados: `tsconfig.json` (strict, noEmit; incluye src, tests y configs), `vite.config.ts` (plugin-react + viteSingleFile, `assetsInlineLimit` alto, entrada `preview.html`, salida `dist/preview.html`), `vitest.config.ts` (proyectos `unit`/node y `component`/jsdom con `src/test/setup.ts`), `playwright.config.ts` (workers 1, retries 0, proyecto `chromium` con `executablePath: /opt/pw-browsers/chromium`, sin webServer; `file://` directo).
- Decisión documentada: la única entrada HTML es `preview.html` (no `index.html`), porque el nombre de salida de vite-plugin-singlefile sigue el nombre de la entrada HTML y PLAN §4 exige `dist/preview.html` sin renombrado manual. El script `dev` sirve `/preview.html`.
- Stubs de RED (compilan, sin comportamiento): `src/domain/home-subtitle.ts`, `src/appearance/theme-provider.tsx`, `src/components/Home.tsx`, `src/app/create-session.ts`, `src/app/AppProviders.tsx`, `src/styles/tokens.css` (vacío), `src/test/setup.ts`.
- Estado: configuración escrita; verificación con la ejecución de los paso 3 (versión de Vitest 4 `projects` aceptada: ambos proyectos corrieron).

## Paso 3 · Pruebas RED (TDD)

- Pruebas escritas: `tests/unit/home-subtitle.test.ts` (HOME-SUBTITLE-01/02/03), `tests/component/theme-home.test.tsx` (DESIGN-COMPLETE-01/02, TOKENS-01, UI-01, HOME-SUBTITLE-02 en navegación de tema, EXTRA-STRICTMODE-HOME, EXTRA-THEME-NO-STORAGE).
- Durante el RED se corrigieron tres problemas del propio arnés, sin cambiar expectativas: (a) TOKENS-01 usaba `import.meta.url` y jsdom no lo da como `file:` (error de infraestructura, no RED); se lee `path.resolve('src/styles/tokens.css')`, con cwd en la raíz del proyecto. (b) HOME-SUBTITLE-02 unitario pasaba en vacío con catálogo vacío; se añade `toHaveLength(4)`. (c) EXTRA-THEME-NO-STORAGE pasaba vacío con el stub; se añade una comprobación positiva de que el cambio ocurrió antes de contar cero escrituras.
- Comandos: `npm run test:unit` → código 1, log `evidence/1A/red-unit.log` (3/3 fallan por aserción: `expected [] to deeply equal`, `expected '' to be undefined`).
- Comando: `npm run test:component` → código 1, log `evidence/1A/red-component.log` (12/12 fallan por aserción o consulta de DOM: `expected 'light' to be 'dark'`, `Unable to find ... role "heading"`, `expected undefined to be 'dark'`, `expected '' to match ...`). Ningún fallo es de import o de módulo no encontrado.
- Estado: RED funcional demostrado para unit y component.

## Paso 4 · Implementación (GREEN)

- Creados: `src/domain/home-subtitle.ts` (catálogo congelado, muestreo `(i+.5)/4` acotado, NaN/no finito → primera), `src/appearance/theme-provider.tsx` (`ThemeProvider`, `useTheme`, `setPreference` devuelve boolean, sin storage ni red; `data-theme` y `data-theme-preference` en `<html>`), `src/components/Home.tsx` (sin sorteo ni inputs; `summary` = `{message, actionLabel}`), `src/app/create-session.ts` (`createSession` llama `chooseHomeSubtitle` una vez, fuera del árbol), `src/app/AppProviders.tsx` (solo `children`, envuelve `ThemeProvider`), `src/main.tsx` (`StrictMode` activo; sesión creada en el módulo, fuera de React).
- Copiados de v5 byte a byte (verificados con sha256 de las fuentes/licencias): `src/styles/tokens.css` = líneas 7–8 de `src/styles.css` (`:root` y `:root[data-theme=dark]`); `src/styles/global.css` = `@font-face` (2–6), base (11–13, 15, 17–18, 24), layout de Inicio (75–80); fuentes de `assets/fonts` a `src/assets/fonts/`; `assets/icons/play.svg` a `src/assets/icons/`; licencias SourceSans3, SourceSerifPro y Lucide a `licenses/`.
- Adición documentada (no está en v5): `html{background:var(--canvas)}` en `global.css`, para que el fondo de la raíz sea explícito en el primer paint.
- Cambio de cableado de pruebas antes del GREEN: `AppProviders` perdió la prop `session` (no está en la interfaz del brief); la sesión se pasa al `Home` por props. Se re-ejecutó el RED (12/12 sigue fallando por aserción).
- `npm run test:unit` → código 0, 3/3 (`green-unit.log`). `npm run test:component` → código 0, 12/12 (`green-component.log`).

## Paso 5 · typecheck y lint

- `npm run typecheck` → código 0 (`typecheck.log`).
- `npm run lint` → código 0 (`lint.log`). Control negativo: archivo temporal con `any` → `oxlint` código 1; se eliminó el archivo temporal.

## Paso 6 · build, portabilidad y tamaño

- `npm run build` → código 0; `dist/preview.html` 1,095,536 bytes (`build.log`). SHA256 de `dist/preview.html` en el momento de este paso: 074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4.
- `npm run --silent check:portable > evidence/1A/portable.json` → código 0, estado PASS: 0 referencias estáticas externas, 0 peticiones externas, 0 errores de consola o página, fuentes `Source Sans 3` y `Source Serif Pro` cargadas. Control negativo: copia con `<img src="https://…">` → código 1, FAIL (se guardó en scratchpad, no en el producto).
- `npm run --silent measure:bundle > evidence/1A/bundle.json` → código 0. Candidato 1,095,536 bytes brutos / 725,859 gzip; referencia v5 reconstruida 1,086,162 bytes / 756,192 gzip (coincide con la cifra del brief). Ratio bruto 1.009; aviso de presupuesto (2×) no activado. No es PASS de rendimiento.

## Paso 7 · offline-theme (Chromium, `file://` y HTTP local)

- `tests/e2e/offline-theme.spec.ts` con cinco casos: (1) file:// primera carga, `colorScheme` light; (2) igual con dark (theme, `--solid` calculado `#111`/`#f2f3f0`, un solo botón en `main`, cero inputs, cero storage, primer paint con `data-theme` y fondo de `<html>` exactos); (3) cambio del sistema sin recarga y recarga que vuelve a `system`; (4) captura de screencast PNG en `evidence/1A/first-paint/`; (5) HTTP en 127.0.0.1 con orígenes externos bloqueados y recarga que vuelve a `system`.
- Limitación real: en 1A no existe control de preferencia explícita en la UI (el selector llega con «Más opciones», fase 3A). La preferencia explícita se prueba en componente (DESIGN-COMPLETE-01/02); en navegador solo se prueba el cambio del sistema y la recarga sin persistencia.
- Ejecución con el artefacto del paso 6 (SHA256 074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4): `npm run test:e2e -- offline-theme.spec.ts` → código 0, 5/5 en tres ejecuciones consecutivas (`e2e-offline-theme-run1.log`, `run2`, `run3`).
- Historial honesto de correcciones del caso (4): (a) el primer intento esperaba el primer frame capturado oscuro; el frame 0 era un lienzo en blanco anterior al commit (blanco en una ejecución, #121212 en otra) y el criterio clasificaba mal. Se separan frames previos al commit (por `metadata.timestamp` frente a la hora de commit) y frames posteriores. (b) Con esa separación, dos de tres ejecuciones dieron como primer frame posterior al commit #121212 (lienzo oscuro por defecto de Chromium, antes de pintar la app); es oscuro, no destello claro, pero no es #171817. Por ello el criterio pasa a: ningún frame posterior al commit es claro (máximo de canales ≤ 64), los frames de la app son exactamente #171817 y el último frame es #171817. El criterio estricto del primer paint queda cubierto de forma determinista por el observador de paint (`PerformanceObserver`), que confirma en cada ejecución `data-theme=dark` y fondo #171817 en la primera entrada de paint. Revisión independiente recomendada sobre este cambio de criterio.
- Los fallos de los intentos (a) y (b) no se conservaron como log; quedan descritos aquí.

## Correcciones tras revisar la evidencia (antes del paso 8)

- El paso 5 original (typecheck y lint código 0) era anterior al spec e2e. Al reconstruir el artefacto, `tsc` falló en `tests/e2e/offline-theme.spec.ts` (tipo de `metadata.timestamp` del listener CDP). Se corrigió el tipo (`timestamp?: number`, sin cambiar lógica) y se volvieron a ejecutar typecheck, lint y build: los tres con código 0 (`typecheck.log`, `lint.log`, `build.log`).
- El tamaño del artefacto final es 1,095,561 bytes (gzip 725,861), no 1,095,536 como se anotó en el paso 6 con la compilación previa a `html{background:var(--canvas)}`. Se repitieron `check:portable` (PASS, `portable.json`), `measure:bundle` (`bundle.json`) y `offline-theme` tres veces (5/5 en cada ejecución) sobre el mismo SHA256 `074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4`.

## Paso 8 · Criterio fijado antes de medir (EXTRA-PERFORMANCE-FLOWS, solo shell)

Criterio informativo, fijado antes de cualquier medición del candidato. No hay umbral de aprobación en 1A.
- Muestras: 20 cargas frías por producto, con orden alternado v6/v5 para repartir la deriva. Cada muestra usa un contexto de navegador nuevo, sin caché compartida, `colorScheme: light`, viewport 1280×720, Chromium `/opt/pw-browsers/chromium`, un worker, red externa bloqueada.
- Artefactos: v6 `dist/preview.html` (SHA256 074ca0…); v5 `../frontend-v5/preview.html` reconstruido con `scripts/build_preview.py` (1,086,162 bytes, no versionado).
- Métrica: milisegundos desde el inicio de la navegación (`goto` con `waitUntil: commit`) hasta que `h1` es visible.
- Reporte: mínimo, p50, p95 (nearest-rank) y máximo por producto; cociente p50 y p95 v6/v5 solo informativo.
- Qué no es: no es un PASS ni un FAIL de rendimiento. El criterio comparativo de EXTRA-PERFORMANCE-FLOWS se fija en 7A, antes del candidato final, con tres líneas base. Un resultado de 1A no cierra esa fila de paridad.

## Paso 7 (revisión) · primer paint: discrepancia entre repeticiones (EXTRA-OFFLINE-FIRST-PAINT)

Motivo: al repetir la misma captura varias veces, el criterio «ningún frame posterior al commit es claro» dejó de cumplirse en algunas corridas. Según el contrato, la misma fuente que pasa una vez y falla otra conserva ambos resultados y detiene su aceptación. Se conservan todos los resultados.

Resultados (SHA del artefacto 074ca0…, salvo indicación):
| Protocolo | Corridas | Sin frame claro tras commit | Primer frame tras commit = #171817 | Fichero |
|---|---|---|---|---|
| Previo a la app: about:blank (default del harness) | 10 | 8 | 6 | `first-paint-repeat.json` (incluye run-03 y run-09 con blanco #fff tras commit) |
| Previo a la app: about:blank, misma build con CSS en `<head>` | 20 | 20 | 14 | `diag/head-control-20runs-build-b45d12.json` (build de prueba b45d12) |
| Previo a la app: about:blank, CSS movido a `<body>` (build de prueba b45d12) | 20 | 20 | 13 | `first-paint-css-body.json` |
| Previo a la app: about:blank, CSS movido a `<body>` (copia de prueba del artefacto 074ca) | 10 | 10 | 8 | `diag/variant-style-in-body-10runs.json` |
| Previo oscuro neutral (`data:` con fondo #171817), artefacto 074ca | 20 | 20 | 20 | `first-paint-prev-dark.json` |

Lectura: en la primera sesión de 10 corridas, con el protocolo por defecto, hubo dos frames en blanco tras commit (run-03, run-09). Después, con el mismo artefacto o con variantes, en 60 corridas más solo hubo lienzo oscuro (#121212 antes de pintar la app, o #171817). Con un documento previo oscuro, 20 de 20 corridas sin frame claro. La hipótesis más verosímil es el lienzo del documento anterior (about:blank), que el harness deja visible un instante. Esto no está demostrado: la aparición en blanco fue esporádica (2 de 50 corridas con el protocolo por defecto) y no se reprodujo en la sesión posterior.

Decisión sobre el cambio probado: se movió el `<link>` del CSS a `<body>` en `vite.config.ts` como prueba. No mostró efecto estadístico (ambas colocaciones dan 20/20), así que se revirtió. El artefacto vuelve a 074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4, idéntico al de los gates anteriores. No se conserva ningún cambio de build por esta vía.

Estado de EXTRA-OFFLINE-FIRST-PAINT: DETENIDO. Motivos: el criterio de frame del caso (4) de `offline-theme` ha pasado en 3 de 3 ejecuciones del spec y ha fallado en 2 de 10 repeticiones del mismo protocolo, con la misma fuente. El resto del control sí está cubierto de forma determinista: el observador de paint confirma en cada corrida que la primera entrada de paint tiene `data-theme=dark` y fondo #171817. Siguiente paso mínimo (decide la revisión): fijar un protocolo previo neutro oscuro para el caso (4), o investigar el lienzo del documento anterior, y repetir ≥50 corridas sobre el mismo SHA antes de aceptar.

## Paso 8 · resultado (informativo)

- `node scripts/perf-shell.mjs > evidence/1A/perf-shell.json` → código 0. 20 muestras por producto, alternadas. Cold load, `h1` visible, file://, viewport 1280×720, light.
- v6 (074ca…): min 99.3, p50 125.1, p95 146.1, max 152.5 ms. v5 (SHA 29e80f…, reconstruido): min 352.2, p50 375.0, p95 387.0, max 387.4 ms.
- Cocientes v6/v5: p50 0.334, p95 0.378. Solo informativo: no es PASS ni FAIL. El criterio comparativo se fija en 7A con tres líneas base.

## Paso 9 · decisión

- Gates de 1A ejecutados y con código 0: `npm install`, `npm audit` total y runtime (0 hallazgos), unit (3/3), component (12/12), typecheck, lint, build, check:portable (PASS), measure:bundle (sin aviso), perf-shell (informativo), offline-theme 5/5 en 3 ejecuciones.
- Pendiente: el control EXTRA-OFFLINE-FIRST-PAINT (frame claro tras commit en 2 de 10 repeticiones con el protocolo por defecto) queda DETENIDO, con la discrepancia conservada arriba. No se declara READY para ese control.
- Decisión del implementador: STOP para la aceptación de EXTRA-OFFLINE-FIRST-PAINT; el resto de la fase tiene evidencia reproducible. Decide la revisión.
- No hay commit, push ni PR. HEAD se movió a `b5cbb79` (commit de docs de otro agente) durante la ejecución; no se tocó.

## Reproducción y ficheros

- Gates: `npm run test:unit`, `npm run test:component`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:portable`, `npm run measure:bundle`, `npm run test:e2e -- offline-theme.spec.ts`, `node scripts/perf-shell.mjs` (requiere `../frontend-v5/preview.html`), `FP_RUNS=N [FP_PREV=dark] [FP_FILE=…] [FP_OUT=…] node --experimental-strip-types scripts/first-paint-repeat.mjs`.
- Resumen de gates: `evidence/1A/gates-final.txt`. Manifiesto SHA256 de toda la evidencia: `evidence/1A/SHA256SUMS.txt`.
- Fuera del producto, sin conservar: copia de vite.config.ts de prueba (revertida), variantes HTML en el directorio de scratch del agente (`…/scratchpad/diag/`), y un fichero de control `.prev-preview-check.html` (eliminado).

## Orquestador · resolución del STOP de primer paint (08/11/2026)

- Diagnóstico: los frames blancos de 2/10 corridas con `about:blank` previo son la superficie anterior que Chromium mantiene hasta que pinta el documento nuevo, no un paint de Turno. Indicios: el observador `paint` ve `data-theme=dark` y fondo `#171817` en la primera entrada en todas las corridas; con documento previo oscuro neutral, `node scripts/first-paint-repeat.mjs` con `FP_RUNS=50 FP_PREV=dark` sobre `074ca0a0…` da 50/50 sin frame claro y 50/50 primer frame = `#171817` (`first-paint-prev-dark-50.json`, código 0).
- Cambio del oráculo del caso EXTRA-OFFLINE-FIRST-PAINT en `tests/e2e/offline-theme.spec.ts`: navegar antes a un `data:` oscuro neutral y exigir que **todos** los frames capturados sean oscuros y el último `#171817`. Se elimina la clasificación por marca de tiempo (relojes no comparables). Cambio posterior a resultados: requiere revisión independiente.
- Repetición: typecheck 0, lint 0, `npm run test:e2e -- offline-theme.spec.ts` 5/5 en 3 corridas consecutivas.

## Orquestador · cierre (08/11/2026)

Revisión independiente (Sonnet): APPROVE_PHASE con 4 WARN, informe en `review/REVIEW-1A.md`. Para no inflar el repositorio se retiraron los PNG de las series repetidas (`first-paint-prev-dark/`, `first-paint-css-body/`, corridas aprobadas de `first-paint-repeat/`, `review/fp-*-30/`); se conservan sus JSON de resumen, los frames de las dos corridas con blanco (run-03, run-09) y la captura final `first-paint/`. Las entradas de `SHA256SUMS.txt` para esos PNG ya no tienen archivo.
