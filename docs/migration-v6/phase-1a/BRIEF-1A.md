# Encargo de la fase 1A · implementador

Fecha: 08/11/2026. Autorización: orden del dueño «vamos con el siguiente paso, orquestas, haiku ejecuta y sonnet testea» (conversación de Claude Code, tras G0 firmado en `8d2737c`) y decisión D10 «Cambiar a oxlint». Alcance: solo la fase 1A. Sin push, PR ni fase 1B.

## Lee completo antes de escribir

1. `docs/migration-v6/agent-contracts/prompts/00-contract.md` (contrato común) y `10-implementer.md` (tu rol).
2. `docs/migration-v6/PLAN.md`: «Global Constraints», sección 4 «Comandos exactos a crear en fase 1A» y «Fase 1A» completa. D1 (tema de sesión) y D10 (oxlint) en la sección 2.
3. Fuentes v5 que se portan (solo lectura, no editar nada en `prototypes/frontend-v5/`):
   - `src/home-subtitle.mjs` y `tests/home-subtitle.test.mjs`
   - `src/theme.mjs` y en `tests/design-complete.test.mjs` las pruebas «theme defaults to system…» y «no matchMedia still gives a usable explicit dark mode»
   - `tests/tokens.test.mjs` (primera prueba) y en `src/styles.css` los bloques `:root{…}`, `:root[data-theme=dark]{…}` y los `@font-face`
   - `src/app.mjs`: función `center()` rama `home` y `homeSummary()`; `tests/ui.test.mjs` prueba «home has greeting, one state summary action and no date input»
   - `assets/fonts/*.woff2`, `assets/icons/*.svg`, `licenses/SourceSans3-OFL.txt`, `SourceSerifPro-OFL.txt`, `Lucide-LICENSE.txt`

## Entorno

- Repositorio `/home/user/turno`, rama `claude/confident-galileo-rahzv6`, base `da55def`. Trabaja solo en `prototypes/frontend-v6/**`.
- Node 24 obligatorio (jsdom 31). En cada comando de shell: `export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH` (Node 24.22.1, npm 11.19.1). Comprueba `node -v`.
- Chromium: no ejecutes `playwright install`. En `playwright.config.ts` usa `launchOptions: {executablePath: '/opt/pw-browsers/chromium'}` en el proyecto `chromium` (la versión instalada de los navegadores es de otro Playwright). Firefox/WebKit no están: no los añadas como gate de 1A.
- Memoria limitada: pruebas siempre con un worker.

## Versiones exactas (dependencias fijas, sin `^`)

dependencies: react 19.3.1, react-dom 19.3.1, @base-ui/react 1.9.0, zustand 5.1.0, clsx 2.1.1, sonner 2.0.8, lucide-react 1.70.0.
devDependencies: typescript 6.0.3, vite 8.3.6, @vitejs/plugin-react 6.2.1, vite-plugin-singlefile 2.3.4, vitest 4.1.12, jsdom 31.0.0, @testing-library/react 16.3.3, @testing-library/user-event 14.6.8, @testing-library/jest-dom 7.0.1, @testing-library/dom 10.4.2, @playwright/test 1.65.0, @axe-core/playwright 4.14.0, oxlint 1.92.0, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 24.19.2.
`engines.node`: `>=24.15.0 <25`; `.node-version`: `24.22.1`. `"private": true`, `"type": "module"`. Scripts exactamente como la tabla del PLAN (lint: `oxlint -c .oxlintrc.json --deny-warnings src tests scripts`).
`.oxlintrc.json`: `{"plugins":["typescript","react","import"],"categories":{"correctness":"error"},"rules":{"react/rules-of-hooks":"error","react/exhaustive-deps":"error","typescript/no-explicit-any":"error"}}`.
Instalar con `npm install --ignore-scripts` (genera `package-lock.json`). Si npm propone otra versión o un peer falla, STOP: no uses `--force` ni `--legacy-peer-deps`.

## Requisitos que cierra 1A (siete) y controles

| ID | Comportamiento | Prueba destino |
|---|---|---|
| HOME-SUBTITLE-01 | Catálogo congelado de cuatro frases exactas: `¿Qué haremos hoy?`, `¿Por dónde empezamos?`, `¿Qué tienes en mente?`, `¿En qué te ayudo hoy?`; sin «Demo» ni `<` | `tests/unit/home-subtitle.test.ts` |
| HOME-SUBTITLE-02 | `random` inyectado llega a cada frase con `(i+.5)/4` y se llama una sola vez | idem |
| HOME-SUBTITLE-03 | `-1` → primera, `1` → última, `NaN` → primera; nunca `undefined` | idem |
| DESIGN-COMPLETE-01 | Preferencia por defecto `system`; sigue cambios del sistema; una elección explícita sobrevive a cambios del sistema; valor inválido rechazado; volver a `system` sigue al sistema | `tests/component/theme-home.test.tsx` |
| DESIGN-COMPLETE-02 | Sin `matchMedia`: efectivo `light` y `dark` explícito funciona | idem |
| TOKENS-01 | `--solid:#111` y `--on-solid:#fff` en `:root`; `--solid:#f2f3f0` y `--on-solid:#171817` en `:root[data-theme=dark]` (tokens completos copiados de v5) | idem (y estilos calculados en e2e) |
| UI-01 | Inicio: `h1` «Hola, Demo.» (o «Hola.» sin nombre), una sola acción de resumen (`onOpenShift`), ningún `input` | idem + `tests/e2e/offline-theme.spec.ts` |

Cada caso de prueba lleva el ID en su nombre (por ejemplo `test('HOME-SUBTITLE-02 · …')`).

Controles adicionales: EXTRA-STRICTMODE-HOME (bajo `<StrictMode>` el subtítulo se sortea una vez por sesión: `createSession`/bootstrap fuera del árbol, `random` llamado 1 vez aunque React monte dos veces), EXTRA-THEME-NO-STORAGE (espía `localStorage.setItem`, `sessionStorage.setItem` y `fetch`: cero llamadas al cambiar tema), EXTRA-OFFLINE-FIRST-PAINT (el atributo `data-theme` se fija antes del primer paint con un script inline en el HTML; sin destello claro al iniciar con sistema oscuro), EXTRA-OFFLINE-ARTIFACT y EXTRA-PERFORMANCE-FLOWS (ver PLAN 1A; en 1A solo shell).

Interfaces: `ThemeProvider({children})`, `useTheme(): {preference: 'system'|'light'|'dark'; effective: 'light'|'dark'; setPreference(value): boolean}` que escribe `data-theme` y `data-theme-preference` en `<html>`; `chooseHomeSubtitle(random?: () => number): string` y `HOME_SUBTITLES`; `Home({preferredName, subtitle, summary, onOpenShift})` no sortea. Cambiar el tema no cambia saludo ni subtítulo. Datos de Inicio: estáticos por props (perfil `Demo`); no crees store, adaptador ni flujos de fases posteriores.

## Pasos (anota cada uno en `prototypes/frontend-v6/evidence/1A/LOG.md` al terminarlo: comando, código de salida, resumen)

1. Crear `package.json`, `.node-version`, `.oxlintrc.json`; `npm install --ignore-scripts`. Ejecutar desde `prototypes/frontend-v6`, sin `|| true`:
   `npm audit --include=dev --json > evidence/1A/audit-total.audit.json; echo $?` y `npm audit --omit=dev --json > evidence/1A/audit-runtime.audit.json; echo $?`. Ambas deben dar 0 vulnerabilidades y código 0. Si no, STOP y reporta.
2. Configs: `tsconfig.json` (strict, noEmit, incluye src, tests y configs), `vite.config.ts` (plugin-react + singlefile, salida `dist/preview.html` comprobada), `vitest.config.ts` (proyectos `unit` node y `component` jsdom con `src/test/setup.ts`), `playwright.config.ts` (workers 1, retries 0, chromium con executablePath, pruebas file:// sin dev server), `index.html`/`preview.html` según elijas, documentado.
3. Escribir las pruebas unit y component con los siete IDs y los controles StrictMode/no-storage. Crear solo stubs mínimos que compilen. Ejecutar `npm run test:unit` y `npm run test:component`: deben FALLAR por comportamiento (aserción), no por import. Guardar salida en `evidence/1A/red-unit.log` y `red-component.log`.
4. Implementar: `src/domain/home-subtitle.ts`, `src/appearance/theme-provider.tsx`, `src/components/Home.tsx`, `src/app/AppProviders.tsx`, `src/main.tsx`, `src/styles/tokens.css` y `global.css` (tokens y `@font-face` copiados de v5, fuentes desde `src/assets/fonts`), copiar fuentes, iconos usados y licencias a `prototypes/frontend-v6/` con sus bytes. StrictMode activo. GREEN en unit y component (logs `green-unit.log`, `green-component.log`).
5. `npm run typecheck` y `npm run lint`: código 0 (logs).
6. `npm run build`, luego `scripts/check-portable.mjs` (busca `src=`/`href=`/`url(`/`import` externos en `dist/preview.html` y además abre el archivo con Chromium bloqueando toda petición no `file:`/`data:`/`blob:`; falla si hay petición externa o error de consola) y `scripts/measure-bundle.mjs` (bytes brutos y gzip, compara con v5 1.086.162 bytes y avisa si supera 2×; no es PASS de rendimiento). Logs y `sha256sum dist/preview.html`.
7. `tests/e2e/offline-theme.spec.ts` sobre `file://…/dist/preview.html`: contexto limpio con red bloqueada; para `colorScheme` light y dark: `data-theme` correcto en el primer documento, h1 «Hola, Demo.», un botón de resumen, ningún input, `--solid` calculado según tema; cambiar preferencia a oscuro/claro; recargar y comprobar que vuelve a `system` (sin persistencia); cero peticiones externas. Primer paint: con `colorScheme: 'dark'`, capturas en serie desde la navegación (o `page.screencast`/trazas) guardadas en `evidence/1A/first-paint/`; afirma que el color de fondo de `<html>` en el primer frame capturado ya es oscuro. Ejecuta `npm run test:e2e -- offline-theme.spec.ts`, log.
8. Arranque del shell (EXTRA-PERFORMANCE-FLOWS, solo 1A): fija primero el criterio en LOG.md (informativo, sin umbral de aprobación), luego 20 cargas frías de v6 y de v5 (`prototypes/frontend-v5/preview.html`, constrúyelo con `python3 scripts/build_preview.py` en v5 si no existe; no se versiona) con el mismo viewport y tema, midiendo hasta que el `h1` esté visible; reporta p50/p95 en `evidence/1A/perf-shell.json`.
9. No hagas commit. Entrega el reporte común (decisión READY_FOR_REVIEW o STOP) con cada gate: comando, código, artefacto y SHA256 del artefacto.

## Prohibido

Editar fuera de `prototypes/frontend-v6/`; tocar v5; `skip`, borrar aserciones, subir tolerancias; `--force`/overrides; storage, red o persistencia en el producto; Tailwind, router, Radix; inventar evidencia o marcar PASS algo que no ejecutaste. Si te bloqueas, deja LOG.md al día y reporta STOP con el siguiente paso mínimo.
