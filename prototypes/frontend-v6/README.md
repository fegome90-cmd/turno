# Turno v6 · candidato integrado 4A/4B

Aplicación React con datos sintéticos y memoria de sesión. Sin backend, autenticación, almacenamiento persistente ni host ChatGPT. La presencia del candidato no acredita una release ni un despliegue.

## Estado

El candidato de código `ed374bed7116d413fa3450d72b61cad4866319a4` conserva la integración 4A/4B de `3495144`: editores y notas, Tiempo/Agenda, guardas, historial y acciones de crear tareas/listas/notas, renombrar listas y cerrar/abrir turnos, con archivo de sólo lectura. Añade las correcciones posteriores de acciones y avisos, incluido Option/Alt+T. Los datos demo se pierden al recargar.

El [estado actual 4B](../../docs/migration-v6/STATUS-4B.md) registra para `ed374be` 162 pruebas unitarias, 319 de componentes y 226/226 Chromium Mac PASS, además de portable PASS. El atajo tiene una comprobación manual acotada de Safari macOS, con procedencia indirecta y sin capturas archivadas. Las dos auditorías siguen BLOCKED y la decisión formal STOP; no se declaran G4A, G4B ni 5A aprobados.

El [registro 3A](docs/EXECUTION-3A.md) y los registros 2B conservan sus resultados históricos. La matriz de ejecución/canon no se modifica desde la implementación: las 27 identidades de cierre 4B siguen `planned`; UI-36 sólo prepara 5A. Las 212 identidades fuente se mantienen intactas.

## Uso y pruebas

Build comprobado con Node 24.22.1 y lock exacto; regresión nativa con Node 24.18.0. Para una instalación nueva, usar `npm ci`; después `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:component`.

- `npm run build`: `dist/preview.html`, producto demo integrado 4A/4B.
- `node scripts/build-history-harness.mjs`: `dist-history/history-harness.html`, controlador técnico 2B, no producto integrado.
- `node scripts/build-layout-harness.mjs`: `dist-layout/layout-harness.html`, slots técnicos EXTRA-NATIVE-EDIT. La variante `?fixture=product-long` monta el mismo App real con sesión/store/puerto e inyección sintética de nombres de 300 caracteres; no usa esos slots.
- `npm run test:e2e -- responsive.spec.ts overlays.spec.ts`: subconjunto de navegación y overlays, no toda la evidencia 4A/4B.
- `npm run build:e2e`: construye producto, historial y layout. `npm run test:e2e` lo ejecuta antes de la suite completa Chromium (workers 1, retries 0), también al seleccionar un subconjunto.
- Chromium usa la instalación de Playwright de cada plataforma. Para un ejecutable ya instalado en un runner, definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; el mismo override se aplica a portable, perf y first-paint. Una ruta inválida falla, no busca un navegador alternativo.
- `npm run test:smoke:engines`: construye el producto y ejecuta un smoke de abrir, editar y guardar en Firefox y WebKit. Requiere los motores de la versión fijada de Playwright; su ausencia falla, no se omite. El smoke no reemplaza la regresión completa ni acredita Safari/iOS.
- `npm run test:tooling`: regresiones de las herramientas de validación y selección de Chromium.
- `npm run check:parity`: integridad de identidades y contratos frente al canon, con destinos y archivos de revisión para filas verificadas. Acepta los cuatro estados del contrato: `planned`, `verified`, `blocked` y `replaced-by-behavior`. Cuenta `blocked` como pendiente y las sustituciones por separado; una sustitución necesita comportamiento, justificación, revisión y metadatos de cierre. Reporta `VALID`/`INVALID` y `functionalParity: NOT_EVALUATED`. No ejecuta los casos ni revalida la evidencia histórica; no aprueba la paridad funcional ni cambia el STOP.
- `npm run check:portable`: HTML exacto y Chromium real sin dependencias externas. Una inspección estática no cierra el gate.
- `npm audit --include=dev --json` y `npm audit --omit=dev --json`: auditorías total/runtime por separado. En este trabajo siguen bloqueadas; no reintentarlas sin resolver el permiso pendiente de enviar nombres y versiones a `registry.npmjs.org`.

## Límites

Las pruebas del App real se distinguen de los harnesses técnicos y los eventos sintéticos. Chromium y tamaños emulados no certifican iPhone físico, Safari iOS, tecnologías de asistencia integrales, IME físico ni una nueva validación de zoom nativo. La comprobación manual del atajo en Safari macOS no cubre esos límites. Fullscreen real se distingue del fallback con API ausente/denegada.

Las auditorías de dependencias no se han ejecutado por restricción de acceso. No hay resultado npm ni conclusión sobre vulnerabilidades; BLOCKED no equivale a PASS ni a FAIL.

El producto conserva el código de `ed374be`. La corrección posterior de tooling añade preparación de artefactos, smoke y validaciones, sin cambiar dependencias, v5 ni canon. La incorporación por el plugin GitHub es un snapshot nuevo sobre la historia remota de `fd777bf`; la historia local original queda respaldada por separado. Sin backend, autenticación, persistencia, colaboración ni host ChatGPT. Este estado no acredita push, merge ni despliegue. Las regresiones completas se repiten después de cualquier integración posterior.

## Trabajo experimental posterior: captura sin LLM

La rama `feature/turno-capture-review-ui-v6` añade captura literal por líneas, tarjetas editables con aprobación individual, condición «antes del cierre» y sugerencias basadas en reglas sobre el estado del turno. No instala ni invoca modelos, ni atribuye resultados a una IA. Conserva el puerto de demostración en memoria; sigue sin existir un backend autenticado de producción.

[Contrato, alcance, límites y verificación](../../docs/ambient-ui-v6.md). Esta sección documenta exclusivamente la rama experimental; no modifica los registros históricos de aceptación 4A/4B.
