# Turno React Base UI Implementation Plan

> **Propuesta auditada del 08/11/2026, sin ejecución de producto.** Leer primero el [estado de preparación](PREFLIGHT.md). G0 sigue pendiente; publicar estos documentos no acepta las precisiones ni inicia la migración. Los pasos usan casillas para seguimiento.

**Goal:** Migrar el prototipo de Turno a React y Base UI sin perder comportamiento, identidad, accesibilidad ni movimiento, con una prueba y un gate verificables para cada objetivo.

**Architecture:** Nueva aplicación aislada en `prototypes/frontend-v6/`; v5 permanece como referencia inmutable. Dominio y adaptador sintético separados del estado de interfaz; componentes React consumen un puerto explícito y nunca llaman al backend. CSS y primitivas Base UI resuelven interacción y movimiento antes de añadir otra dependencia.

**Tech Stack:** React 19, TypeScript, Vite, `@base-ui/react`, zustand, clsx, Sonner, lucide-react, vite-plugin-singlefile, Vitest, Testing Library y Playwright. Versiones exactas y compatibilidad se fijan en la fase 1; no se asumen instaladas. Tema de sesión mediante proveedor propio; `motion/react` solo tras justificar una necesidad que CSS y Base UI no cubran.

**Corte React 08/11/2026:** leer [investigación y gates](REACT_RESEARCH.md). Conjunto propuesto para revalidar en 1A: React/React DOM 19.3.1, Base UI 1.9.0, Vite 8.3.6, plugin-react 6.2.1 y TypeScript 6.0.3 con typescript-eslint; ya ensayado solo en el fixture de PREFLIGHT. No está instalado en producto. Compiler Babel 1.0.0 es opcional y posterior; el port Oxc experimental no forma parte de la base. No se añade servidor/RSC ni persistencia.

**Spec:** `prototypes/frontend-v5/docs/MIGRACION_REACT.md` en [HEAD 0f534df](https://github.com/fegome90-cmd/turno/blob/0f534df9bd5b012b4ec21c202a055e1e913bcab5/prototypes/frontend-v5/docs/MIGRACION_REACT.md), contrastado con `turno-v6-plan-standalone.html` de referencia y con el código vigente. Las precisiones de este documento se proponen para aceptación; no se atribuyen a decisiones ya aprobadas.

**Estado de esta entrega documental:** el plan y su preparación se incorporan al PR #2; no se crea frontend-v6 ni se instala tooling en el producto. La instalación y los ensayos anteriores fueron de un fixture aislado, resumidos en PREFLIGHT.md. No se hace merge ni despliegue. La ejecución del producto queda tras resolver G0 y aceptar las decisiones pendientes. El backend se desarrolla por separado: su disponibilidad no se presume ni bloquea la demo aislada.

## Global Constraints

- `frontend-v5/` queda intacta; carpeta nueva `prototypes/frontend-v6/`, rama aislada y un PR por fase solo cuando se autorice publicar.
- «Sin backend, autenticación, API ni persistencia, igual que la v5». Incluye no escribir la preferencia de tema en storage: el código vigente es explícitamente de sesión.
- Datos sintéticos, perfil público `Demo`, sin datos identificables de pacientes. El nombre personalizado solo entra como opción local no versionada, no como autenticación.
- React 19 + TypeScript + Vite y `@base-ui/react`. Sin Tailwind, sin router que cambie la URL; no importar componentes Radix del ui-kit. Se pueden reutilizar tokens y diseño con sus licencias.
- Fechas visibles `DD/MM/AAAA`, hora 24 h, zona `America/Santiago`; fecha civil ISO `YYYY-MM-DD` en dominio, sin convertirla en instante.
- Títulos entre 1 y 300 caracteres; cuerpo hasta 10.000; minutos enteros de 0 a 1440. Vacío es distinto de cero; nunca corregir silenciosamente un texto inválido.
- Navegación en columna desde 700 px; Tiempo en columna desde 1000 px, salvo Inicio o preferencia explícita de ocultarlo. No unificar ambos umbrales.
- Saludo, nombre y frase variable permanecen. Frase sorteada una vez por sesión y estable en navegación, filtros, tema y apertura de Tiempo.
- El cierre de turno conserva tareas pendientes y notas; un nuevo turno empieza vacío. Archivo de solo lectura. El prototipo no programa ni cancela avisos externos.
- Pruebas con concurrencia 1. No contar DOM simulado, regex de CSS, axe, emulación o capturas como lector de pantalla/dispositivo real.
- Cada cambio debe registrar SHA, comando, resultado y artefacto. `PASS`, `FAIL`, `BLOCKED` y `NOT RUN` no son equivalentes.

## Review Focus

1. StrictMode, remount o respuesta tardía: no duplicar historial, sesión, sorteo del saludo ni guardados; no robar foco a una edición más reciente. Tareas 2A, 2B y 4A.
2. Composición IME, teclado móvil y redimensionado durante escritura: conservar borrador crudo, selección, undo y errores; Enter de composición no guarda. Tareas 3A y 4A.
3. Avisos simultáneos con Dialog/Drawer y cierre durante animación: no perder errores, enfocar controles ocultos ni emitir anuncios dobles. Tareas 1B y 5A.
4. `file://`, iframe, APIs ausentes y almacenamiento bloqueado: app legible y operativa sin red ni excepciones; simulación de iframe no demuestra host ChatGPT. Tareas 1A, 2B y 7A.
5. Datos largos/literales y fechas en límites civiles: sin HTML inyectado, truncar identidad, sobreflujo, desplazamiento de día ni clamp numérico inadvertido. Tareas 2A, 3A y 4A.

---

## 1. Fuentes y baseline verificado

Referencia anterior a esta actualización documental, comprobada el 08/11/2026: [PR #2](https://github.com/fegome90-cmd/turno/pull/2) abierto como borrador, HEAD `0f534df9bd5b012b4ec21c202a055e1e913bcab5`, base `addd5a3189e0c9acc5e9b2a5b12e64030228a39e`, 14 commits y 82 archivos cambiados. Su árbol contiene 83 archivos. El último commit de código es `7141568f9fc765a2a2555a689a4df76dc9bfa44f`; HEAD solo añade el documento de migración. La base 714 del documento es, por tanto, coherente para comportamiento.

Los cuatro commits del [PR #1](https://github.com/fegome90-cmd/turno/pull/1), cerrado sin merge propio, sí están incluidos en la historia del PR #2 mediante `1c4ae4063794177f6368db955a46aeeab8695229`. Antes de esta actualización documental, el cuerpo del PR #2 describía un estado anterior en d0256f4: sus 176 pruebas y su afirmación de divergencia no deben copiarse como evidencia actual.

Para esta preparación se recuperó una copia del árbol remoto, se verificaron sus blobs y se ejecutaron los checks existentes en esa copia. No es una revisión visual. Consultar el anexo A para resultado final, entorno, comandos y límites. La matriz del anexo B enumera las pruebas fuente y su destino de migración; ningún resultado v5 acredita por sí mismo React.

No hay fuente v6 en el árbol inspeccionado. No había ejecuciones de GitHub Actions ni estados de commit para este HEAD; CodeRabbit aparece omitido por draft, no aprobado. No se adopta una cifra de tests como gate: el gate es conservar los comportamientos trazados.

El HTML adjunto y el MD coinciden en ocho fases y stack. El HTML es un resumen del plan, no un preview de React: carga Google Fonts y no demuestra portabilidad. Las fuentes de la app siguen siendo Source Sans 3 y Source Serif Pro locales con licencias, no Source Serif 4 por imitación del documento.

## 2. Alcance y decisiones que el plan precisa

### Se conserva lo ya elegido

React 19, TypeScript, Vite, Base UI, nueva carpeta, separación de v5, no router de URL, datos de demo y fases pequeñas. Identidad visual del PR #2 con las correcciones integradas de PR #1. No rediseñar ni cambiar textos como efecto de adoptar una librería. Excepción aceptada (D7): los grupos de tareas pasan de «Cama» a «Lista» en la v6 ([glosario](GLOSARIO.md)); es el único cambio de texto. La revisión de identidad visual (D8) ocurre después de la migración, no durante.

### Precisiones recomendadas para aceptar con este plan

1. **Tema:** proveedor de sesión propio basado en `theme.mjs`, con `data-theme` y `data-theme-preference`. next-themes guarda preferencias por defecto; no usarlo así. Si se quiere next-themes, demostrar antes que no escribe almacenamiento y conserva exactamente el contrato. No abrir un proyecto de persistencia.
2. **Más opciones:** Popover/disclosure no modal, no Menu cuando contiene el selector de tema. Debe permitir Tab fuera, cerrar por click externo/Escape y conservar el destino del click; sin trampa de foco ni `role=menu` impropio.
3. **Validación:** `Field`/`Form` presentan estado y asociaciones accesibles. `validation.ts` y el adaptador siguen validando datos. No sustituir validación de dominio por la de una librería de controles.
4. **Avisos:** Sonner es el candidato previsto, condicionado a paridad. Un adaptador público puede completar lo que falte. Una regresión no se cierra diciendo «documentada»: bloquea la fase hasta corregir o acordar explícitamente una excepción.
5. **Pruebas de navegador:** Chromium es mínimo de la fase 7; Firefox/WebKit y dispositivos/AT tienen resultados separados. Si no hay infraestructura, declarar BLOCKED; no eliminar escenarios para conseguir verde. Además (D5): revisión de diseño local del dueño con Paper e Impeccable durante las fases 3A–4B; se registra aparte y no cuenta como evidencia de cierre.
6. **Host:** preparar un límite de adaptación, no conectar ChatGPT/backend durante esta migración. El empaquetado offline y la integración real del widget son entregables distintos. Una revisión de contrato temprana evita decisiones incompatibles, pero no certifica host.
7. **Producto y vocabulario (D7, aceptada 08/11/2026):** Turno es un gestor de tareas general para trabajos por turnos; enfermería es un caso de uso. La v6 usa «Lista» en lugar de «Cama» en interfaz y pruebas; el resto del vocabulario de v5 queda congelado y pendiente de validación de dominio.
8. **Identidad visual (D8, aceptada 08/11/2026):** dirección de arte, paleta y tipografía aplican, en una fase de identidad posterior a 7B con su propio encargo y criterio de cierre. Las fases 0–7B mantienen la identidad del PR #2 sin rediseño.
9. **Movimiento (D9, aceptada 08/11/2026):** la v6 copia el movimiento de v5 (ver 6A); no se añaden animaciones durante la migración.

Alternativas consideradas: migración en la carpeta v5 (descartada por pérdida de referencia y colisiones), mezcla progresiva React/vanilla en un mismo DOM (descartada por doble autoridad sobre foco e historial), nueva v6 aislada (recomendada y ya prevista). No se vuelve a elegir framework ni Base UI.

## 3. Secuencia y reglas de ejecución

Las [lecciones de casos estudiados](EXECUTION_LESSONS.md) forman parte obligatoria de la planificación y ejecución. El [mapa operativo](migration-risks.json) asigna IDs `EXTRA-*` a fases, escenarios, oráculos y clase de evidencia. Complementa la matriz de 212 identidades sin modificarlas ni presentar riesgos React nuevos como pruebas fuente v5. El brief de cada tarea incorpora los controles que le corresponden; no basta enlazar los artículos. No crean otra fase ni una aprobación por artículo: se verifican en los gates existentes.


Dependencias: `0 → 1A → 1B → 2A → 2B → 3A → 4A → 4B → 5A → 6A → 7A → 7B`. 4B depende de los editores/guardas de 4A; no ejecutarlas en paralelo como si fueran independientes..

### Preparación temprana y cierre integrado

En la matriz, `preparationTask` identifica el ensayo inicial; `task` es el primer cierre posible de la identidad fuente completa. `integrationTasks` enumera las fases que deben estar presentes y `closureEvidenceKinds` fija la clase mínima de evidencia. El anexo B reproduce esos campos y destinos, comprobados por `check_docs.py`. El brief 1A contiene exactamente sus siete identidades cerrables; las otras diez originales figuran diferidas y siguen planned. G0 continúa STOP.

Un harness de 1B/2B/3A puede probar su contrato técnico/EXTRA y permitir terminar esa tarea, sin marcar verificados requisitos de UI que dependen de producto posterior. No introducir mocks de Agenda, editor, archivo o avisos para fingir su integración. Las siete identidades 1A cubren tema/default/fallback, catálogo/sorteo, tokens y Home mínimo; sus datos/actions pueden ser props estáticas, sin demostrar TurnoPort ni flujos futuros.

Cierre por dependencias reales: Home+Tiempo/navegación y UI-25/Agenda en 4A; historial 01–05/07–09 integrado en 4A y rename/Back HISTORY-06 en 4B; archivo/renombrado, Agenda del turno nuevo vacío y resumen sin turno en 4B; suspensión/avisos y anuncios no duplicados en 5A; CSS completo y cláusulas de movimiento/disclosure/tabs/pila en 6A. El detalle de las 212 filas sigue en el anexo. En 7A/7B se repite la evidencia final afectada; un PASS antiguo no se hereda tras cambiar integración o estilos.

Un gate `browser` que cierre estas identidades lleva `scope: product-integration`, sus `integrationTasks`, los testcases del requisito y el artefacto del producto real. El checker rechaza fase prematura, contrato canónico cambiado, unit por browser o harness por producto. No demuestra semántica por metadatos: el revisor inspecciona componentes conectados, escenario y oráculo reales.

Después de 2A, tokens/primitivas y pruebas de dominio pueden prepararse en paralelo en archivos disjuntos. No paralelizar cambios simultáneos de store, historial y overlays. Tras cada tarea: revisión de especificación y luego calidad por un revisor independiente; resolver primero bloqueantes y repetir las pruebas afectadas. Al final, revisar toda la rama. Investigar sistemáticamente los fallos inesperados y verificar el estado final antes de cualquier afirmación de cierre.

El método de ejecución organiza el trabajo, no reemplaza evidencia. TDD: test del comportamiento faltante → ejecución RED por causa esperada → implementación mínima → GREEN → suite afectada → revisión → commit local acotado. Un test que falla por paquete ausente demuestra solo falta de setup; tras resolver setup debe fallar por el comportamiento que se está implementando.

No escribir en la rama del otro trabajo ni modificar backend, plugin, manifiestos de despliegue o ui-kit. Si se autoriza publicar, comprobar HEAD remoto y checks del SHA exacto antes de describir el PR como verificado; la ausencia de CI se declara, no cuenta como PASS. Un PR por fase puede encadenarse contra la anterior; antes de publicar, comprobar diff y base para no incluir trabajo ajeno. Cambiar la base de un PR no implica hacer merge. Publicar mediante push/PR, catálogo y despliegue necesita autorización separada. Las lecturas no la requieren.

## 4. Estructura y contratos

Todas las rutas siguientes son propuestas para crear al ejecutar. No existen todavía.

- `prototypes/frontend-v6/src/domain/{types,format,validation,draft-state}.ts`: tipos y funciones puras; no React ni APIs de host.
- `src/adapters/{turno-port,preview-adapter}.ts`: interfaz de dominio y demo en memoria. Ningún SDK de backend.
- `src/app/{create-session,store,App,AppProviders}.ts[x]`: una sesión por bootstrap, store y composición.
- `src/navigation/{history-controller,use-history}.ts`: índice de historial y restauración, sin alterar URL.
- `src/appearance/theme-provider.tsx`, `src/appearance/motion-policy.ts` y `src/styles/{tokens,global,motion}.css`: tema/estilos de sesión.
- `src/components/{AppShell,Navigation,MoreOptions,OverlayCoordinator,Home,TaskEditor,NoteEditor,TimePanel,Agenda,ShiftDialogs,BedDialogs}.tsx`: unidades de interfaz.
- `src/notifications/{notification-store,sonner-adapter}.ts` y `NotificationStack.tsx`: estado de avisos separado del renderer.
- `src/test/setup.ts`, `src/test/fixtures.ts`, `src/test/render-app.tsx`, `tests/unit`, `tests/component`, `tests/e2e`: suites por evidencia; helpers solo implementados una vez.
- `scripts/{check-portable,measure-bundle,check-parity}.mjs`: packaging, bytes y cobertura de matriz.
- `docs/{ADR-001,ACCEPTANCE,HOST-BOUNDARY,QA-REPORT}.md` y `docs/parity-map.json`: decisiones, criterios, frontera host, informe y trazabilidad.

### Tipos compartidos

En `domain/types.ts`, conservar nombres y representación de v5:

```ts
type Priority = 'low' | 'normal' | 'high';
type Shift = {id: string; label: string; date: string; status: 'open' | 'closed'};
type Bed = {id: string; shiftId: string; label: string};
type Task = {id: string; shiftId: string; bedId: string | null; title: string;
  body: string; reason: string; priority: Priority; date: string | null;
  time: string; estimate: string; performed: string; duration: string;
  completed: boolean; version: number};
type QuickNote = {id: string; title: string; body: string; version: number};
type Snapshot = {profile: {preferredName: string}; activeShiftId: string | null;
  shifts: Shift[]; beds: Bed[]; tasks: Task[]; notes: QuickNote[]};
type TemporalDraft = {date: string; time: string; estimate: string;
  performed: string; duration: string};
type FieldErrors = Partial<Record<'title'|'body'|keyof TemporalDraft, string>>;
type Selection = {kind: 'task'|'note'; id: string} | null;
type Route = {view: 'home'|'workspace'|'notes'|'archive'; selected: Selection;
  archiveId: string | null};
```

`TurnoPort` contiene únicamente `load(): Promise<Snapshot>`, `saveTask(task: Task): Promise<Task>`, `saveNote(note: QuickNote): Promise<QuickNote>`, `createNote(title: string): Promise<QuickNote>`, `createBed(label: string): Promise<Bed>`, `renameBed(id: string, label: string): Promise<Bed>`, `createTask(title: string, bedId?: string | null): Promise<Task>`, `closeShift(id: string): Promise<Shift>` y `openShift(label: string): Promise<Shift>`. `PreviewPort` lo extiende con `failNext(kind: 'error'|'conflict'): void`; esa operación solo aparece en controles Demo.

`createSession({port, random, now})` se llama fuera del árbol que StrictMode reevalúa. Produce `{store, homeSubtitle, dispose}`; el store no vive en un singleton de módulo compartido entre instancias. `createTurnoStore(port)` produce estado confirmado, borrador y raw temporal, errores, busy, selección, filtros y acciones; solo se actualiza lo confirmado tras respuesta exitosa. Las pruebas inyectan latencia/errores; no se afirma que simulan correctamente un backend inexistente.

### Comandos exactos a crear en fase 1A

Todos corren desde `prototypes/frontend-v6`. `vitest.config.ts` separa proyectos `unit` (environment `node`, `tests/unit/**/*.test.ts`) y `component` (environment `jsdom`, `tests/component/**/*.test.tsx`, setup `src/test/setup.ts` con jest-dom y cleanup). Tests sin hardware nativo permanecen rotulados componente. Playwright usa `workers: 1`, `retries: 0` durante aceptación, trace/video/screenshot de fallos, y proyecto principal `chromium`; smoke adicionales `firefox` y `webkit` se reportan separadamente. Las pruebas file:// lanzan navegador real y no pasan por el dev server.

| Script | Comando exacto propuesto |
|---|---|
| `dev` | `vite --host 127.0.0.1 --port 4176` |
| `typecheck` | `tsc --noEmit -p tsconfig.json` |
| `lint` | `eslint src tests scripts *.config.ts` |
| `test:unit` | `vitest run --project unit --maxWorkers=1 --no-file-parallelism` |
| `test:component` | `vitest run --project component --maxWorkers=1 --no-file-parallelism` |
| `test:e2e` | `playwright test --project=chromium --workers=1` |
| `test:smoke:engines` | `playwright test tests/e2e/smoke.spec.ts --project=firefox --project=webkit --workers=1` |
| `build` | `tsc --noEmit -p tsconfig.json && vite build` |
| `preview` | `vite preview --host 127.0.0.1 --port 4176` |
| `check:portable` | `node scripts/check-portable.mjs dist/preview.html` |
| `measure:bundle` | `node scripts/measure-bundle.mjs dist/preview.html` |
| `check:parity` | `node scripts/check-parity.mjs docs/parity-map.json` |

`tsconfig.json` incluye src, tests y configs con `strict: true`, `noEmit: true`, JSX React, bundler resolution y librerías DOM/ES pertinentes; no excluir tests para ocultar errores de tipos. Vite singlefile entrega `dist/preview.html`: usar `preview.html` como entrada Rollup o renombrar salida explícitamente en build y comprobar el nombre en test, no asumir que index.html se renombra solo. Playwright webServer ejecuta el build/preview configurado a4176 y usa reuseExistingServer=false para no probar un proceso ajeno.

Dependencias de test/config a fijar en lockfile: TypeScript, Vite, @vitejs/plugin-react, vite-plugin-singlefile, Vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, @playwright/test, @axe-core/playwright, ESLint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, @types/react, @types/react-dom y @types/node. Crear `eslint.config.mjs` con reglas recomendadas TypeScript/React Hooks y sin ignorar errores de hooks. Verificar compatibilidad oficial de todas las versiones y engines antes de fijarlas y contrastar [el corte actual](REACT_RESEARCH.md). React 19.3.1 y Base UI 1.9.0 se instalaron conjuntamente solo en el fixture de PREFLIGHT, no en producto; su paridad no se presume. TypeScript 7.0.2 queda fuera del soporte publicado de typescript-eslint; mantener la recomendación 6.0.3 hasta revisar el conjunto. Fijar también Node probado en `.node-version` y `engines`: el fixture configuró el rango de engines >=24.15.0 <25 por jsdom y demás herramientas; la versión ejecutada fue 24.22.1; el mínimo de Vite/plugin no acredita todo el conjunto. Vite transpila, no comprueba tipos. Compiler no se activa en el bootstrap.

`check-parity` falla si falta una de las212 filas, hay ID duplicado, no existe destino/testcase por requirementId, falta evidencia del SHA final, una fila sigue planned/blocked al cierre o una sustitución no tiene justificación/revisión. La estructura inicial es planned; no puede pasar antes de implementar y reunir evidencia. `check-portable` busca referencias externas/imports no embebidos y ejecuta smoke en navegador sin red; una mera regex no acredita ejecución.

## 5. Fases y tareas verificables

### Fase 0 · Fijar contrato y autorización de ejecución

**Control incorporado:** `EXTRA-ROLLBACK-PHASE`: identificar referencia/candidato, SHA/hash de artefactos y vuelta segura en sandbox; no llamar estable a la referencia con discrepancias pendientes. En el brief, gate `baseline` no visual.

**Objetivo:** una referencia reproducible y una correspondencia de cada comportamiento con su prueba, sin reabrir decisiones resueltas.

**Preparación para iniciar:** [FASE_0.md](FASE_0.md) concreta entradas, roles, tareas/tests/gates y bloqueos. Los [borradores ADR](phase-0/ADR-001.md), [aceptación](phase-0/ACCEPTANCE.md), [frontera](phase-0/HOST-BOUNDARY.md) y [registro G0 STOP](phase-0/G0-RECORD.md) no ejecutan esta fase ni expresan aprobación.

**Archivos de ejecución futura:** adoptar `docs/ADR-001.md`, `docs/ACCEPTANCE.md`, `docs/HOST-BOUNDARY.md`, `docs/parity-map.json` bajo la futura raíz `prototypes/frontend-v6/`, solo tras autorizar ese alcance; leer v5 sin editar. La matriz canónica de `docs/migration-v6/parity-map.json` no se sustituye; el anexo B es el inventario inicial.

**Interfaces:** [`parity-map.json`](parity-map.json) contiene `{sourceSha, sourceFile, sourceTest, requirementId, targetTests: string[], targetCases: string[], targetBehavior, task, preparationTask, integrationTasks: string[], closureEvidenceKinds: string[], integrationRationale, status, rationale, evidence: string[]}`. Estados permitidos: `planned`, `verified`, `replaced-by-behavior`, `blocked`; no borrar pruebas silenciosamente ni usar `verified` sin evidencia.

- [ ] Releer [REACT_RESEARCH.md](REACT_RESEARCH.md) y PREFLIGHT; registrar producto instalado, fixture ensayado y propuesta por separado, sin cerrar G0 por una investigación.
- [ ] Confirmar HEAD remoto, árbol y estado de otras ramas antes de comenzar. Si cambió, enumerar delta y rebaselinar requisitos afectados.
- [ ] Verificar hashes y repetir `node --test --test-concurrency=1 tests/*.test.mjs`, `python scripts/build_preview.py`, `node scripts/check_portable.mjs` en v5 aislada.
- [ ] Registrar 16 suites fuente, cada test y resultado real; una regex de CSS se mapea a una observación visual/accesible equivalente, no se porta literalmente a JSX.
- [ ] Acordar las seis precisiones de la sección 2 y confirmar qué se entiende por final: prototipo v6 autónomo, no widget integrado.
- [ ] Documentar por lectura el límite con backend: nombres/versiones reales aún por contrastar, sin fijar un contrato de escritura inexistente ni modificar el otro trabajo.
- [ ] Revisión de diseño y del plan; commit local de los documentos solo cuando exista rama autorizada para ejecución.

**Gate G0:** baseline identificado, todas las pruebas inventariadas y plan aceptado. La preparación de este plan no equivale a G0 aprobado por el usuario. Si una decisión cambia UX, preguntar esa decisión concreta; no construir primero.

### Fase 1A · Bootstrap, tokens, tema y HTML autónomo

**Controles incorporados:** `EXTRA-PERFORMANCE-FLOWS` (solo shell: arranque/tema/bundle en esta fase, criterio previo y 20 muestras) y `EXTRA-OFFLINE-ARTIFACT` (hash final, file frío/recarga sin red; HTTP con servidor del documento disponible, sesión nueva sin persistencia). Evidencia de navegador en `offline-theme` y `portable`; no cerrar desde regex/jsdom. Ver método y mapa.

**Objetivo:** una pantalla Inicio mínima, accesible y offline que preserve identidad y tema de sesión.

**Archivos:** crear `package.json`, lockfile, `index.html`, `vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.node-version`, `src/main.tsx`, `src/app/AppProviders.tsx`, `src/components/Home.tsx`, `src/appearance/theme-provider.tsx`, `src/styles/{tokens,global}.css`, `src/domain/home-subtitle.ts`, assets/licencias y scripts portables.

**Interfaces:** `ThemeProvider({children})` expone `useTheme(): {preference: 'system'|'light'|'dark'; effective: 'light'|'dark'; setPreference(value): void}`. `chooseHomeSubtitle(random?: () => number): string` conserva exactamente `¿Qué haremos hoy?`, `¿Por dónde empezamos?`, `¿Qué tienes en mente?` y `¿En qué te ayudo hoy?`. `Home({preferredName, subtitle, summary, onOpenShift})` no vuelve a sortear.

- [ ] Escribir `tests/unit/home-subtitle.test.ts` y `tests/component/theme-home.test.tsx`. Aserciones: las cuatro frases exactas; random NaN/fuera de rango nunca devuelve undefined; `Hola, Demo.` o `Hola.` sin nombre; cambiar tema no cambia saludo/subtítulo; no llamadas a `localStorage.setItem`, `sessionStorage.setItem` ni red.
- [ ] Fijar versiones/Node/lock compatibles y registrar instalación limpia, peers/engines y árbol real de dependencias/config/plugins RSC; aplicar los avisos oficiales vigentes. Repetir auditoría total y runtime por separado: las 10 moderadas dev históricas no quedan resueltas por React 19.3.1. Aplicar gates estructurados `audit-total` y `audit-runtime` del contrato: toda vulnerabilidad es FAIL/STOP, también si se documentó aceptación; los errores de infraestructura son BLOCKED. No existe bypass de aceptación en este MVP. No forzar peers ni ocultar tipos.
- [ ] Preparar solo el runner y un componente mínimo que deje el test RED por ausencia de comportamiento. Registrar la salida.
- [ ] Implementar proveedor de sesión, bootstrap de tema antes del primer paint y tokens/copias de assets. React StrictMode habilitado en desarrollo; no ocultar sus efectos dobles.
- [ ] `npm run test:unit -- home-subtitle` y `npm run test:component -- theme-home`: PASS. Sin matchMedia debe funcionar el tema explícito. Cambio de SO solo afecta preferencia `system`.
- [ ] Implementar build singlefile y scripts de portabilidad/medición. Vite por sí solo no basta. `npm run build && npm run check:portable && npm run measure:bundle`: HTML sin imports/links/red necesarios, fuentes e iconos locales incluidos.
- [ ] `npm run test:e2e -- offline-theme.spec.ts`: abrir el hash final de `dist/preview.html` por file en contexto limpio, bloquear red y recargar; datos/tema vuelven a la sesión inicial. Por HTTP mantener el servidor del documento disponible y bloquear solo orígenes externos; no prometer recarga con servidor inaccesible. Probar ambos temas y sistema. Captura de primer paint mediante filmstrip: sin destello claro al iniciar en oscuro. Reportar bytes brutos y gzip del HTML/JS; propuesta de alerta de presupuesto: 2× bytes brutos de v5, no un PASS de rendimiento automático.
- [ ] Revisar y commit local `feat(v6): add offline shell and session theme`.

**Gate G1A:** ejecución offline real del shell y solo sus siete identidades cerrables, fuentes preservadas, tema sin persistencia y sin parpadeo observado. Si no hay navegador, el build puede pasar, el gate de navegador queda BLOCKED. Dependencias fijadas por lockfile y APIs/versiones oficiales comprobadas; no instalar «latest» a ciegas.

### Fase 1B · Probar composición de primitivas antes de migrar

**Actualización React/Base UI:** aplicar [G1B de la investigación](REACT_RESEARCH.md): APIs públicas de la versión fijada, portales/stacking/tema y foco reales; el filtrado Menu preview de Base UI 1.9.0 no es base funcional. Un peer resuelto no acredita estos controles.

**Controles incorporados:** `EXTRA-LIFECYCLE-ASYNC` y `EXTRA-NATIVE-EDIT`: 20 ciclos con cleanup, efectos no duplicados, portales/tema abiertos con tokens/contraste y foco correctos. Un root principal; Context no cruza roots independientes. Gates `component` no visual y `chromium` navegador, con alcance específico del mapa.

**Objetivo:** descartar pronto incompatibilidades de Base UI/Sonner con foco, capas, historial y borrador.

**Archivos:** crear `src/components/TemporalField.tsx` (wrapper candidato de campo crudo), `src/components/OverlayCoordinator.tsx`, `src/notifications/{notification-store,sonner-adapter}.ts`, `src/notifications/NotificationStack.tsx`, `tests/component/primitive-contract.test.tsx`, `tests/e2e/primitive-contract.spec.ts`. El harness de pruebas no se convierte en pantalla del producto.

**Interfaces:** `OverlayLayer = {id: string; kind: 'navigation'|'time'|'more'|'confirm'|'create'|'rename'; returnFocusKey: string|null}` y `OverlayState = {layers: OverlayLayer[]}`. El último elemento es topmost; se permite Drawer → Popover o Drawer → Dialog. Abrir Dialog cierra el Popover previo, no remonta el editor. Escape/Back cierra solo topmost y restaura foco a un destino todavía visible; el coordinador es la única autoridad de capas. La pila permite representar la composición que se prueba, no una unión de un solo kind. Notificaciones: `notify(message: string, kind: 'status'|'error'): string`, `dismiss(id: string, modality: 'pointer'|'keyboard'): void`, `setSuspended(value: boolean): void`, `clear(): void`.

- [ ] Tests RED: el editor y sus campos sobreviven docking 699↔700/999↔1000 con selección, undo y raw inválido; portales no crean dos controles ni reinician IME. Dialog sobre Drawer devuelve foco correcto; Escape cierra una capa; Popover de tema deja salir con Tab; 30 avisos no expulsan errores; modal vuelve inert/no accesible la pila; fallo de notificación no crea un guardado exitoso.
- [ ] NumberField temprano: con la API pública/versionada candidata, escribir `abc`, `-1`, `1.5`, `1441`, vacío y `0`; blur, cerrar/reabrir panel, cambiar tema y docking. Conservar texto crudo exacto/errores/selección sin clamp ni convertir vacío en cero. Probar en componente y navegador reales del harness; no necesita el dominio de 2A. Si NumberField normaliza o descarta raw, STOP en G1B y decisión explícita entre adaptación pública viable o Field/input de texto validado. Registrar la elección antes de migrar el editor, sin diferir la incompatibilidad a 4A.
- [ ] Implementar harness mínimo con APIs públicas verificadas de la versión fijada. No depender de selectores internos de Sonner/Base UI ni asumir que una prop significa comportamiento accesible.
- [ ] Ejecutar componente y navegador: `npm run test:component -- primitive-contract && npm run test:e2e -- primitive-contract.spec.ts`. Inspeccionar foco real, accesibilidad y cierre repetido durante animación, además de prueba de árbol.
- [ ] Registrar matriz API → necesidad → evidencia → adaptación pendiente. Determinar si Sonner acepta el registro controlado, suspensión y retención requeridos.
- [ ] Revisar y commit local `test(v6): prove primitive composition contracts`.

**Gate G1B:** ningún incumplimiento fundamental oculto, incluido contrato raw de TemporalField/NumberField probado antes de adoptarlo. El harness no cierra filas de paridad de editor/layout/pila todavía no integrados. Si Sonner no cumple, usar API pública/custom renderer para cerrar brecha o detener y proponer alternativa acotada. No degradar la pila v5 ni sustituirla sin decisión. Prueba local de iframe sirve para aislamiento y portales; no certifica CSP ni host ChatGPT.

### Fase 2A · Portar dominio y estado de sesión

**Controles incorporados:** `EXTRA-LIFECYCLE-ASYNC` y `EXTRA-STATE-AUTHORITY`: un dueño por estado, una operación por acción, respuesta tardía inocua y snapshot/borrador conservados tras fallo/conflicto; contadores de suscripciones vuelven a baseline tras desmontaje. Gate `unit` no visual.

**Objetivo:** paridad de datos, validación y operaciones simuladas sin acoplar UI a backend.

**Archivos:** crear `src/domain/{types,format,validation,draft-state}.ts`, `src/adapters/{turno-port,preview-adapter}.ts`, `src/app/{create-session,store}.ts`; pruebas `tests/unit/{format,validation,draft,preview,store}.test.ts`.

**Interfaces:** tipos de sección 4 y funciones `parseDate(value: string): string|null`, `displayDate(value: string|null): string`, `localDate(now?: Date): string`, `nextCalendarDate(date: string): string`, `groupAgenda(items: Task[], now?: Date): {date:string|null;label:string;tasks:Task[]}[]`, `validateEditor(draft: Task, temporal: TemporalDraft, note?: false): FieldErrors` y overload `validateEditor(draft: QuickNote, temporal: TemporalDraft|null, note: true): FieldErrors`, `createTemporalDraft(task?: Task|null): TemporalDraft`, `applyTemporalDraft(task: Task, raw: TemporalDraft): Task`, `createPreviewAdapter({delay?, preferredName?}): PreviewPort`.

- [ ] Portar tests de preview/validation/draft y fechas de polish, conservando valores esperados. Agregar RED de sesión duplicada y respuestas tardías para store.
- [ ] Ejecutar `npm run test:unit -- format validation draft preview store`: falla por las funciones faltantes, no por un entorno roto.
- [ ] Portar lógica sin cambiar semántica; snapshots desacoplados; errores no mutan datos; versión conflictiva no pisa el borrador; renombrar cama no cambia IDs ni pertenencia; nota sin turno/cama.
- [ ] Añadir casos exactos: `29/02/2028` válido, `29/02/2027` inválido, `31/02/2026` conservado como raw; `23:59` válido/`24:00` inválido; minutos `''`, `'0'`, `'1440'` válidos y `'-1'`, `'1.5'`, `'1441'` inválidos. Límites UTC/Santiago, fin de mes/año/bisiesto y fecha de DST, sin sumar 24 h para «mañana».
- [ ] Verificar títulos 1/300/301, cuerpo 10.000/10.001, texto HTML literal, cama de otro turno, cierre repetido, turno nuevo vacío, archivo inmutable y estado compartido no accidental entre dos instancias.
- [ ] GREEN de suite completa de unidad + `npm run typecheck`. Revisar y commit `feat(v6): port preview domain and isolated store`.

**Gate G2A:** mismas transiciones confirmadas y errores que v5, contratos tipados, ninguna llamada de red/persistencia. Zustand almacena UI y copias confirmadas; no se inventan optimistic updates ni dominio del backend.

### Fase 2B · Historial y navegación protegida

**Control incorporado:** `EXTRA-LIFECYCLE-ASYNC`: start/dispose repetidos y StrictMode no duplican listener ni entrada; respuesta antigua no navega ni roba estado de selección nueva. Gates `unit` no visual y `chromium` navegador; historia/foco reales no se cierran desde la pila simulada.

**Objetivo:** contrato del controlador Atrás/Adelante con harness de rutas/guardas/overlays. El producto integrado se cierra después: 4A y 4B según matriz.

**Archivos:** crear `src/navigation/{history-controller,use-history}.ts`, `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`.

**Interfaces:** `createHistoryController({history, subscribePopState, readRoute, applyRoute, guardNavigation, setTitle}): {start(): void; push(route: Route): void; dispose(): void}`. `subscribePopState(listener: (state: unknown) => void): () => void` devuelve unsubscribe; es inyectable tanto desde window como desde la pila fake. `start` es idempotente, `dispose` elimina sus listeners y no hay acceso global implícito. `guardNavigation(target: Route, resume: () => void): 'allow'|'blocked'|'pending'` delega decisión al coordinador/store, no al navegador. Cada entrada lleva `idx` además de Route.

- [ ] Escribir RED del contrato de controlador de history v5 (la décima, IME, pertenece a 4A). Ensayar con harness técnico, sin cerrar todavía HISTORY-01–09: carga inicial replace sin push, una entrada por navegación, render no duplica, título correcto, restaurar Home/tarea sin push; overlays/busy conservan Forward; cancelar/descartar y guardar-y-continuar repiten dirección original una vez.
- [ ] Agregar reattach de efectos en StrictMode, entrada ajena sin idx y dispose: no duplicar listeners ni reemplazar navegación exterior de forma agresiva. No URL nueva, no router.
- [ ] Implementar controlador inyectable y hook con cleanup. Modelo de pila para unit tests; `history.go(delta)` real en E2E.
- [ ] `npm run test:unit -- history-controller && npm run test:e2e -- history.spec.ts`: PASS en file y HTTP; historial externo preservado, entradas propias identificadas. Error al guardar mantiene vista y borrador.
- [ ] Revisión y commit `feat(v6): preserve indexed history and draft guards`.

**Gate G2B:** en el harness del controlador, no pérdida de Forward, no doble navegación ni título desfasado. HISTORY-01–05/07–09 permanecen planned hasta integración 4A; HISTORY-06 espera BedDialogs/rename de 4B. `EXTRA-LIFECYCLE-ASYNC` sí se evalúa aquí en ese alcance técnico explícito. El historial en sandbox del host queda fuera de la afirmación de este gate.

### Fase 3A · Layout, navegación y overlays responsivos

**Control incorporado:** `EXTRA-NATIVE-EDIT`: una instancia interactiva, caret/selección/undo/raw al cruzar umbrales; checkbox no activa fila, outside-click conserva destino y Escape/Back consumen solo la capa superior sin doble handler. Gate `chromium` navegador.

**Objetivo:** montar navegación y layout reales con slots/primitivas de ensayo para editor/Tiempo aún ausentes. Los ensayos de borrador/Agenda/confirmación de esta fase no cierran esas identidades integradas posteriores.

**Archivos:** crear `src/components/{AppShell,Navigation,MoreOptions,DemoDialog}.tsx`, completar `OverlayCoordinator.tsx`, `src/styles/layout.css`, `tests/component/navigation.test.tsx`, `tests/e2e/{responsive,overlays}.spec.ts`.

**Interfaces:** `AppShell({navigation, editor, timePanel})`; `MoreOptions({theme, onThemeChange, onDemo})`; decisiones de breakpoint en una sola función `getPanelMode(width: number): {navigation: 'column'|'drawer'; time: 'column'|'drawer'}`. Overlay/selección del store, no estado paralelo en cada panel.

- [ ] RED: 699/700 y 999/1000, 320 px nombre largo, cierre de turno como icono <400 px con nombre accesible, Más opciones no modal, scroll cue solo si queda contenido.
- [ ] Implementar columnas/Drawer, footer Archivo/Más opciones y toolbar del PR #2. Checkbox y botón de tarea no solapan sus áreas táctiles de 44 px. Editor centrado limitado a 76ch; grid usa ancho disponible.
- [ ] Probar 320, 390, 699, 700, 999, 1000, 1024 y 1440 px, altura baja y nombres multilingües de 300 caracteres. `scrollWidth <= clientWidth` en viewport y zonas sin scroll horizontal deliberado. No deducir móvil de agente de usuario.
- [ ] Con draft inválido, caret/selección, scroll y propiedad abierta: cambiar ida/vuelta de breakpoint y fullscreen repetidamente. Mantener solo una instancia interactiva por campo; sin perder undo/composición. Si trasladar portal desmonta control, usar arquitectura estable y no aceptar solo «valor restaurado».
- [ ] Escape/Back cierran la capa debida; foco vuelve a un control visible. Cambiar tema/filtro no remonta editor ni cambia saludo/frase. Inicio mantiene Tiempo como overlay incluso ancho.
- [ ] `npm run test:component -- navigation && npm run test:e2e -- responsive.spec.ts overlays.spec.ts`. Inspección real de foco, no solo document.activeElement simulado.
- [ ] Revisar y commit `feat(v6): migrate responsive shell and navigation`.

**Gate G3:** sus 17 identidades de navegación/layout disponibles y el contrato técnico con harness son verificables. La conservación del editor/Tiempo/Agenda, archivo y suspensión de avisos sigue planned hasta 4A/4B/5A según matriz; no exigirlos como producto final aquí ni cerrarlos con slots. Repetir responsive/overlays tras cada integración. Fullscreen/resize del harness no demuestra los componentes futuros. Fullscreen API denegada/ausente es fallback seguro y se informa como escenario distinto de fullscreen real.

### Fase 4A · Editor, notas y validación

**Controles incorporados:** `EXTRA-STATE-AUTHORITY` y `EXTRA-NATIVE-EDIT`: promesas controladas y fallo/conflicto no sustituyen draft; Enter durante composición no guarda; selección/copia/undo, teclas y foco nativos sobreviven resize/overlay. Gates `component` no visual y `chromium` navegador; IME real se cierra en 7B.

**Objetivo:** edición segura de tareas/notas con errores precisos y comportamiento de teclado intacto.

**Archivos:** crear `src/components/{TaskEditor,NoteEditor,TimePanel,Agenda,UnsavedChangesDialog}.tsx`, completar `src/app/App.tsx` conectando store/puerto, Home, navegación, historial y guardas, `tests/component/{editor,time-panel,agenda}.test.tsx`, `tests/e2e/editor.spec.ts`.

**Interfaces:** editores reciben selección/draft/raw/errors/busy/readOnly del store y acciones `editField(field, rawValue)`, `save(): Promise<void>`, `cancel(): void`, `setCompleted(id, completed): Promise<void>`; no mutan Snapshot directamente. `TimePanel` consume una sola instancia de TemporalDraft.

- [ ] RED con tests ui/interface-skills/emil-skills: Enter guarda draft dirty, clean no guarda, IME isComposing/keyCode229 no guarda ni cancela evento; pegar saltos se normaliza y compositionend normaliza sin romper composición.
- [ ] Implementar título textarea autoajustable; Field/Form conectan label/error sin borrar raw. Error previo permanece al editar campo ajeno y solo se limpia cuando ese error se resuelve.
- [ ] Repetir la elección TemporalField/NumberField validada en 1B, ahora conectada al raw/errors del store, validación 2A y guardado de TaskEditor/TimePanel. NumberField: escribir texto inválido, perder foco, cerrar/reabrir Tiempo y cambiar tema; el texto y error sobreviven. Distinguir vacío/0; no clamp 1441 a 1440. Si API no lo soporta, bloquear elección o usar Field/input de texto validado previa decisión, nunca cambiar silenciosamente valor.
- [ ] Tabs Tarea/Agenda con nombres y paneles relacionados, roving focus/Home/End/flechas; solo indicador se anima al puntero. Collapsible conserva estado, cierre inmediato y foco fuera del contenido oculto.
- [ ] Agenda con Hoy/Mañana/fecha/Sin fecha, pendientes independiente de filtro de navegación, prioridad Alta con icono decorativo y texto; notas rápidas sin propiedades de tarea.
- [ ] Simular fallo/conflicto/latencia y doble click: una operación, draft conservado, checkbox confirmado restaurado, insignia solo cambia tras éxito y respuesta antigua no roba foco a un nuevo campo. Cancelar restaura todos los controles y feedback.
- [ ] Integrar y ejecutar Home → Tiempo/Agenda → turno/tarea → Home con UI-14/UI-40/UI-41/VIEWPORT-07; mismo nodo/sorteo/saludo, resumen real y sin reinicios al cambiar tema/ancho. Ejecutar UI-25 completando una tarea real, filtrar pendientes y observar Agenda independiente. Repetir historial 01–05/07–09 y responsive/overlays sobre componentes reales, sin sustituir TimePanel/Agenda/editor por harness.
- [ ] `npm run test:component -- editor time-panel agenda && npm run test:e2e -- editor.spec.ts history.spec.ts responsive.spec.ts overlays.spec.ts`. IME por eventos/CDP es emulación; verificar además composición manual real en G7B.
- [ ] Revisar y commit `feat(v6): port editors validation and agenda`.

**Gate G4A:** integración real de Home, editor/notas, TemporalField, Tiempo/Agenda, navegación e historial/guardas. No cerrar aquí los requisitos de archivo de 4B, avisos de 5A ni animación de 6A; sus partes funcionales se ensayan y quedan planned. Las reglas de dominio y presentación son coherentes; no datos perdidos, falsas confirmaciones ni duplicados. Texto literal se renderiza como texto; sin dangerouslySetInnerHTML.

### Fase 4B · Crear, renombrar, cerrar y consultar archivo

**Objetivo:** flujos completos de demo con confirmaciones correctas y recuperación de fallos.

**Archivos:** crear `src/components/{ShiftDialogs,BedDialogs}.tsx`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.

**Interfaces:** acciones del store delegan a TurnoPort; modal de cierre lee el conteo confirmado actual y muestra «Cerrar y archivar». No aceptar un cierre real del backend mediante esta confirmación de demo.

- [ ] RED: crear tarea/cama/nota/turno, título vacío corregible, nombres duplicados con IDs distintos, renombrar dirty con Volver/Descartar/Guardar y continuar, fallo conserva texto, submit repetido no duplica.
- [ ] Implementar Dialog/AlertDialog con nombre, descripción y retorno de foco. Confirmación de cierre conserva pendientes; no dice que se cancelaron avisos. Archivo deshabilita ambas vías de completar y renombrar.
- [ ] Probar conflicto y reintento sin salir del diálogo; primer inválido visible incluso si Tiempo estaba cerrado; plural/singular correcto; cerrar y abrir turno deja cero camas/tareas nuevas, notas globales conservadas.
- [ ] Repetir también HISTORY-06 (Back cierra rename preservando Forward), DESIGN-COMPLETE-12 (oscuro/fallo/reintento/archivo readonly), EMIL-SKILLS-09 (rename largo literal) y UI-42 (singular y sin turno), UI-29 (cerrar/abrir/crear turno y Agenda vacía) sobre integración real.
- [ ] `npm run test:component -- domain-dialogs && npm run test:e2e -- shift-lifecycle.spec.ts history.spec.ts responsive.spec.ts`: PASS. Revisar y commit `feat(v6): migrate shift and bed workflows`.

**Gate G4B:** ciclos con fallos, cancelar y reintentar conservan identidad y estado. No se añade borrar ni otra operación fuera de v5.

### Fase 5A · Avisos persistentes con Sonner

**Objetivo:** migrar la pila funcional y conservar las 22 identidades fuente. Las cláusulas de movimiento/interrupción se ensayan ahora y se cierran/revalidan en 6A, no se declaran todas cerradas en 5A.

**Archivos:** completar módulo notifications de 1B; `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.

**Interfaces:** contrato notify/dismiss/setSuspended/clear de 1B; identidad estable y registro independiente del render. Mensajes son texto literal. Mensaje normal y error tienen anuncio apropiado y no duplicado.

- [ ] Portar RED de 22 casos toasts, cambiando selectores internos por roles/testids propios. Añadir prueba explícita de modal + 30 errores + cierre enfocado + reapertura durante salida.
- [ ] Configurar duración infinita, pila expandida y botón individual; Alt+T enfoca último, Escape solo cierra dentro de pila; agrupar duplicado en mismo id y anunciar repetición diferenciada.
- [ ] Implementar foco de siguiente/anterior/fallback cuando corresponde, nunca mover foco ajeno. Llegada nueva conserva scroll si se está leyendo; sigue final si ya estaba al fondo. Cierre enfocado remueve accesibilidad inmediatamente.
- [ ] En Dialog/Drawer, suspender controles y anuncios, deferir anuncio nuevo y reanudar sin revivir eliminados. Cambio a reduced motion o teclado termina salidas pendientes y cancela frames. Al pasar de puntero a teclado, también cancela las animaciones ya en curso, no solo las siguientes.
- [ ] `npm run test:unit -- notification-store && npm run test:component -- notifications && npm run test:e2e -- notifications.spec.ts`: PASS. Cada fila fuente debe tener destino verificable; no basta 22 tests nominales.
- [ ] Revisión y commit `feat(v6): preserve persistent notification behavior`.

**Gate G5:** pila/foco/errores integrados con editor, navegación y modales reales; repetir responsive/overlays para suspensión y validación/rename para anuncios (VIEWPORT-02/03/06, INTERFACE-SKILLS-01, UI-27/28/36). Las 12 filas TOASTS cuyo contrato incluye movimiento permanecen planned hasta G6, aunque sus ensayos parciales funcionen. Cero regresiones funcionales dentro del alcance que se cierra. Una limitación no cubierta de Sonner es FAIL/BLOCKED, no una nota aceptable por sí misma. No confundir toasts de UI con Programadas de ChatGPT.

### Fase 6A · Movimiento y detalles visuales

**Actualización React:** ViewTransition/addTransitionType y Fragment refs son estables en 19.3, pero opcionales. CSS/Base UI primero; evaluar solo por mejora concreta con paridad, reduced motion explícito, interrupciones y fallback. Compiler Babel estable, si se justifica, requiere un cambio aislado posterior a paridad con/sin Compiler y verificación de transformación; `compiler: true` de plugin-react usa Oxc experimental y queda fuera de la base. No atribuir benchmarks upstream a Turno. Véase [investigación](REACT_RESEARCH.md).

**Objetivo:** preservar carácter y respuesta inmediata sin bloquear estado, foco ni accesibilidad.

**Archivos:** crear `src/appearance/motion-policy.ts`, `src/styles/motion.css`; tests `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.

**Interfaces:** `motionPolicy({modality, reducedMotion, kind})` devuelve duración y propiedades permitidas; una fuente de valores para estilos/controladores. Copiar valores actuales: pantalla150, diálogo240, drawer260, disclosure220, pestañas150, feedback180, toast300 ms; hover 180 ms (`--motion-feedback`), igual que v5. Curva drawer `cubic-bezier(0.32,0.72,0,1)`; curvas restantes de `motion.mjs`.

- [ ] RED: pasar de puntero a teclado durante apertura de pantalla/Drawer o movimiento de Tabs cancela también la animación en curso; teclado no inicia transiciones de apertura/desplazamiento, reduced motion elimina transform/filter, pantalla solo opacidad, duración máxima300; no `transition:all`.
- [ ] Implementar CSS/data attributes Base UI; estado y foco cambian inmediatamente, nunca esperan animationend. Priorizar opacity/transform sin reflow por frame. No añadir motion/react salvo brecha concreta documentada y medida.
- [ ] Conservación: estado pulsado del botón principal solo por color (v5 no escala al pulsar), fades de navegación, marcador de Tabs y entrada/salida de avisos; filters/temas/render rutinario no repiten entradas. Reduced motion permite fade ≤150 ms en contenido; avisos se resuelven síncronos conforme a su contrato.
- [ ] Interrumpir/revertir repetidamente; retomar desde estado pintado actual; desmontar cancela efectos/listeners. API animate ausente deja todo usable. Cambiar preferencia reduced en mitad del movimiento no revierte intención.
- [ ] Cerrar las cláusulas completas de disclosure/tabs (POLISH-01/02/03/05/07/12, UI-22/24), las 12 filas TOASTS diferidas y CSS completo DESIGN-COMPLETE-11. Repetir con componentes/pila de producto reales, no solo motion-policy/harness.
- [ ] `npm run test:unit -- motion-policy && npm run test:e2e -- motion.spec.ts notifications.spec.ts editor.spec.ts`: PASS, más revisión visual con video y perfil de rendimiento de interacción en equipo identificado. Un límite de duración no demuestra 60 fps.
- [ ] Revisar y commit `feat(v6): preserve motion with reduced-motion safeguards`.

**Gate G6:** sin animaciones perdidas por defecto, sin movimiento innecesario nuevo, sin estado sujeto a frames y sin afirmar fluidez no medida. Excepciones necesitan decisión explícita.

### Fase 7A · Verificación agregada y auditoría de rama

**Actualización seguridad/toolchain:** repetir contra el lock/SHA final el inventario RSC/config, advisories oficiales, auditoría total/runtime y checks separados de tipos, lint, tests, build y HTML portable por hash. Cero advisories runtime no equivale a auditoría total ni a ausencia de XSS. No reutilizar evidencia del fixture. Las versiones upstream no cierran G7B ni H. Véase [investigación](REACT_RESEARCH.md).

**Controles incorporados:** `EXTRA-PERFORMANCE-FLOWS`, `EXTRA-OFFLINE-ARTIFACT` y `EXTRA-ROLLBACK-PHASE`: comparación production por flujos existentes con criterio fijado antes del candidato, artefacto exacto sin dependencias externas y reapertura en sandbox de la referencia anterior. Gates `chromium` y `portable` navegador. El cierre final incluye todos los EXTRA canónicos con la clase de evidencia exigida; una unit verde no cierra navegador.

**Objetivo:** evidencia reproducible de paridad y límites de la v6 candidata.

**Archivos:** completar `scripts/check-parity.mjs`, `docs/parity-map.json`, `docs/QA-REPORT.md`, `tests/e2e/{accessibility,offline-theme,responsive,overlays,history,editor,shift-lifecycle,notifications,motion,smoke,performance,rollback}.spec.ts` y README. Mantener artefactos pesados fuera de Git salvo política explícita.

- [ ] `npm ci --ignore-scripts` desde checkout limpio y lockfile. Verificar si las dependencias necesitan pasos oficiales de instalación; no ejecutar scripts desconocidos solo para desbloquear.
- [ ] Ejecutar `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:component`, `npm run build`, `npm run check:portable`, `npm run measure:bundle`, `npm run test:e2e`, `npm run check:parity`; todos PASS, sin skip/todo no justificado ni consola con errores. Configurar esos scripts en fase1, no inventarlos al cierre.
- [ ] Chromium real: temas claro/oscuro/sistema, forced-colors claro/oscuro, widths/umbrales G3, altura baja, WCAG1.4.12, reduced motion, historial, IME emulado, fullscreen/resize, foco, file frío/recarga sin red, HTTP con servidor del documento disponible pero sin orígenes externos, y fallback APIs ausentes. Axe complementa, no sustituye revisión.
- [ ] Firefox/WebKit: smoke de cargar/editar/guardar simulado, diálogo, historial, tema, portabilidad. Ejecutar `npm run test:smoke:engines`. Si el motor no está disponible, registrar BLOCKED por motor sin atribuirle Chromium.
- [ ] Medir contraste calculado ≥4.5:1 para texto normal; ≥3:1 controles/foco y texto grande cuando corresponda; inspeccionar foco visible y orden de lectura, nombres accesibles, áreas44 px y 200% zoom real, sin confundir deviceScaleFactor con zoom.
- [ ] Revisar baseline v5 y v6 lado a lado con mismos datos/viewport/tema; aprobación visual independiente registrada por pantalla y cambio, no aceptación masiva de screenshots nuevos.
- [ ] Revisar diff completo: solo v6 y documentos permitidos, v5 intacta, sin secretos/datos privados ni backend. Revisar licencias y versiones.
- [ ] Revisor independiente informa bloqueantes/menores con paths y evidencia. Corregir, repetir checks y auditar SHA final. Commit de cierre local.

**Gate G7A:** todos los criterios automatizables trazados y comprobados; ninguna regresión bloqueante/alta abierta. Informe distingue probado, fallado, bloqueado y no ejecutado. Si faltan comprobaciones requeridas, candidata pendiente, no «lista».

### Fase 7B · Validación manual y entrega con alcance exacto

**Control incorporado:** `EXTRA-NATIVE-EDIT` exige evidencia `manual-ime` de composición real; no se hereda de eventos/CDP ni de un artículo. Táctil y lector de pantalla siguen sus gates manuales propios.

**Objetivo:** probar lo que automatización no demuestra y entregar un prototipo sin prometer integración.

- [ ] Dispositivo táctil real: teclado móvil, campos sin tapar, pinch zoom permitido, safe areas, selección de texto, orientación, Drawer sin gesto accidental que pierda borrador.
- [ ] Lector de pantalla real con combinación registrada (por ejemplo NVDA/Firefox o VoiceOver/Safari): flujo editor, errores, diálogo, estado readonly, pila y foco. No atribuir un árbol accesible a anuncio real.
- [ ] IME real: escribir/componer/confirmar candidato y después Enter para guardar; probar resize/overlay sin interrumpir composición. Teclado físico: recorrido, Escape, Alt+T, Tab y Back/Forward.
- [ ] Registrar host/backend por separado: fuente frontend, pruebas locales, persistencia, integración SDK, publicación catálogo, interfaz visible. En este plan las últimas cuatro siguen fuera de alcance y no demostradas.
- [ ] Entregar HTML autónomo, código/plan/matriz/informe y lista de límites, con revisión del usuario. Publicación de PR, merge o despliegue solo por instrucción específica; no cerrar el trabajo paralelo.

**Gate G7B:** PASS únicamente con evidencia manual de las combinaciones exigidas. Un bloqueo explícito conserva G7B pendiente, nunca lo cierra. «Prototipo React comprobado localmente» solo si corresponde; nunca «Turno integrado» por esta migración. El gate de host H siguiente no se incluye en los PASS locales.

### Fase posterior · Identidad visual (D8), fuera de esta migración

Tras 7B y con un encargo propio: dirección de arte, paleta, tipografía y nombres neutros revisados para un gestor de tareas general. Usa las skills marcadas como aplicables en el [inventario de la auditoría](design-audit/INVENTORY_REVIEW.md) y la revisión local con Paper e Impeccable. Sus cambios se miden contra la v6 con paridad ya cerrada, no contra la v5.

## 6. Gate H de integración futura con el otro trabajo

Este gate es una dependencia para una futura integración, no una tarea autorizada en esta preparación. Cuando ambos trabajos tengan versión candidata y se autorice integrar:

1. Verificar release/plugin real, herramienta/resource URI/SDK, metadata y CSP/sandbox vigentes; no deducirlos del repo del prototipo o de una skill histórica.
2. Mapear TurnoPort a contrato backend exacto: campos, errores, versiones, reintentos/idempotencia, autorización/owner, cierres, estado del turno y notas; rechazar discrepancias explícitamente. Store no acepta ownerId del cliente como autoridad.
3. Probar widget montado en ChatGPT real: tamaños inline/fullscreen, eventos de host, foco al cerrar/volver, permisos, tema, resource/asset loading y ausencia de filtración de datos. `file://` no acredita ninguna de estas condiciones.
4. Persistencia real y aislamiento multiusuario con datos sintéticos y entorno autorizado; fallos/reintentos no duplican tareas/avisos. No fabricar respuestas para cerrar el gate.
5. Separar avisos de UI de recordatorios nativos; una intención registrada no demuestra Programadas creada, y programación no demuestra push recibido.

Sin evidencia de esas cinco capas, resultado H = NOT RUN/BLOCKED, aunque G0–G7 estén verdes. No conectar credenciales, activar facturación, cambiar seguridad ni publicar catálogo como efecto secundario.

## 7. Riesgos y respuesta

- **Divergencia de HEAD:** rebaselinar delta y revalidar pruebas afectadas, nunca mezclar resultados de SHAs distintos.
- **Librería que modifica interacción:** adaptar por API pública o bloquear; accesibilidad anunciada por proveedor no certifica Turno.
- **Remount de campos:** preservar identidad funcional (selección/undo/IME), no solo copiar valor tras pérdida. Pueden requerirse contenedores estables en vez de alternar portales.
- **Peso offline:** medir incrementos por dependencia, tree-shaking/imports específicos; no borrar fuentes ni funciones para cumplir un presupuesto arbitrario. Si supera alerta propuesta de 2×, analizar antes de aceptar.
- **Tests que fijan implementación:** sustituir por pruebas del resultado, conservando requisito/justificación y revisión. Cero cobertura perdida por renombrar suite.
- **Falsa equivalencia demo/producción:** etiquetar claramente datos/mensajes simulados; no demostrar backend con PreviewPort.
- **Infraestructura incompleta:** bloqueo con acción exacta que falta (motor, dispositivo, host o permiso), sin degradar gate a «documentado».

## 8. Registro requerido por cada gate

Auditorías estructuradas obligatorias: `audit-total` (`npm audit --include=dev --json`) y `audit-runtime` (`npm audit --omit=dev --json`) desde 1A, nuevamente en cada tarea de producto y siempre en 7A/cierre final; ausencia de manifest/lock no permite omitirlos. JSON nativo v2 separado, contexto y manifest/lock actuales, riesgos por paquete. Cero findings + exit 0 = PASS; findings + exit 1 = FAIL/STOP, incluso aceptados; error de red/npm/formato = BLOCKED. Véase el [contrato exacto](agent-contracts/prompts/00-contract.md).

Una fila por ejecución: fase/tarea, requirementId, SHA, entorno/versiones, fixture, comando o pasos manuales, fecha, resultado, artefacto (log/traza/video/captura), revisor y límites. Un resultado antiguo no se hereda después de un cambio afectado. La matriz debe resolver todas las filas a tests o sustitución de comportamiento aceptada; todo `blocked` impide cerrar el objetivo que cubre.

Formato de cierre recomendado: «Fase X verificada en [entornos], SHA [x]. Pasaron [checks concretos]. Pendiente/no ejecutado [escenarios]. No integra backend ni host». No usar número total de tests como resumen de accesibilidad o preparación productiva.

## 9. Revisión para empezar

El plan mantiene lo decidido: Base UI, React, carpeta nueva, demo aislada, identidad, saludo/frase, tema y animaciones. Pide aceptar sus precisiones de preservación de comportamiento y su frontera con el backend antes de implementar. Recomendación de ejecución: tareas pequeñas con revisión independiente por tarea y de rama completa. Esta entrega prepara esa ejecución; no la inicia.


## Dictamen de revisión independiente

**Dictamen histórico de la propuesta anterior, no aprobación de esta corrección.** La revisión inicial comprobó alcance, contratos, etapas, gates y matriz de 212 casos; no detectó entonces bloqueantes restantes; la auditoría posterior detectó cierres prematuros por dependencias y falta de gate estructurado de auditoría, corregidos en esta revisión y sujetos a nueva revisión independiente. Se corrigieron capas anidadas, validación de notas sin temporal, suscripción inyectable a popstate, scripts/entornos exactos, cierre manual estricto y equivalencia de SVG frente a las máscaras v5.

Este dictamen no es aprobación del usuario ni certifica implementación. No existe v6. Después de esta revisión del plan se probaron dependencias conjuntas en un fixture aislado, con los límites y fallos de PREFLIGHT.md; navegador, tecnologías de asistencia y host continúan sin demostrarse. **G0 requiere aceptación del usuario.**


# Anexo A · Evidencia y estado actual de la preparación

Referencia de código: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`; último código de producto: `7141568f9fc765a2a2555a689a4df76dc9bfa44f`. Fecha: 08/11/2026.

- Los **83/83 blobs** del snapshot coinciden con la referencia remota, incluidos assets y licencias. El contraste se repitió antes de esta publicación documental.
- Hubo recorridos completos de **212/212 PASS**, pero el **último recorrido completo registrado fue 210 PASS y 2 FAIL**. Repetir solo los dos casos dio 2 PASS. Esa repetición focalizada no sustituye la suite fallida ni demuestra estabilidad. G0 no se certifica.
- `python scripts/build_preview.py`: PASS, HTML de **1.086.162 bytes**. `node scripts/check_portable.mjs`: PASS en Node/LinkeDOM. Ninguno demuestra layout, foco nativo ni ejecución offline real.
- El fixture aislado de herramientas pasó tipos, lint, 2 tests de unidad, 1 de componente y build. No contiene Turno React ni prueba paridad de producto. La auditoría total conserva **10 moderadas de desarrollo**, frente a 0 en runtime; el gate total permanece FAIL.
- Navegador, visual, móvil/IME/lector de pantalla real y host no están acreditados. Las 212 filas de la matriz continúan `planned`.

El [informe de preparación](PREFLIGHT.md) registra los casos fallidos, comandos, versiones, límites y procedencia de estas observaciones. Los logs originales no se publican: el resumen no convierte en PASS un FAIL, BLOCKED o NOT RUN. Las comprobaciones documentales de esta actualización se describen en el [índice](README.md).

Fuentes versionadas:

- [PR #2](https://github.com/fegome90-cmd/turno/pull/2) y [commits](https://github.com/fegome90-cmd/turno/pull/2/commits).
- [Propuesta inicial](../../prototypes/frontend-v5/docs/MIGRACION_REACT.md).
- [Tema de sesión](../../prototypes/frontend-v5/src/theme.mjs).
- [Pruebas de viewport](../../prototypes/frontend-v5/tests/viewport.test.mjs), [historial](../../prototypes/frontend-v5/tests/history.test.mjs) y [avisos](../../prototypes/frontend-v5/tests/toasts.test.mjs).
- [Base UI Drawer v1.9.0](https://github.com/mui/base-ui/blob/v1.9.0/packages/react/src/drawer/index.ts) y [Tabs.Indicator](https://github.com/mui/base-ui/blob/v1.9.0/packages/react/src/tabs/index.parts.ts): exports de referencia. Instalación conjunta no implica paridad de interacción.


`finalTargetTests` conserva regresiones pospuestas (por ejemplo, accessibility en 7A); no se puede eliminar del contrato canónico. El cierre final exige la unión de targetTests y finalTargetTests del canon. La mera existencia del archivo no demuestra ejecución: sus targetCases deben aparecer en evidencia fresca de la clase de cierre requerida y el revisor confirma que el log incluye realmente esas regresiones.

# Anexo B · Matriz inicial de paridad

**212 requisitos fuente; todos planned para React, sin evidencia v6.** `tarea` indica el primer cierre planificado con el comportamiento completo integrado; preparación/harness no cierra la identidad. Destinos bajo `prototypes/frontend-v6/`, aún por crear. El checker preserva el contrato de cierre del canon y exige la clase de evidencia aplicable, además del SHA/árbol y testcases. Repetir al cierre final toda evidencia afectada por cambios posteriores.


## design-audit.test.mjs (11)

- **DESIGN-AUDIT-01 · tarea 4B · planned**
  Fuente: compact footer keeps Archive and a disclosure while close shift moves to toolbar
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-02 · tarea 3A · planned**
  Fuente: checkbox target is a native wrapping label with no adjacent action in its 44px target
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-03 · tarea 4A · planned**
  Fuente: high priority is text plus a decorative icon in both tree and Agenda
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-04 · tarea 4A · planned**
  Fuente: priority badge follows confirmed save only, survives failed save and disappears after a lower priority save
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-05 · tarea 4A · planned**
  Fuente: metadata has visible bound labels and long reason round-trips with the draft
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-06 · tarea 4A · planned**
  Fuente: selected filter is redundantly identified and does not reset editor or scroll
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-07 · tarea 4B · planned**
  Fuente: compact mobile navigation retains direct controls, identity and simulated Escape focus restoration
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.
- **DESIGN-AUDIT-08 · tarea 4B · planned**
  Fuente: archive preserves high-priority text and disables both completion paths
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-AUDIT-09 · tarea 4A · planned**
  Fuente: typography, border affordances, shared editor edge and hover guards are explicit contracts
  Destino: `tests/component/theme-home.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: typography, border affordances, shared editor edge and hover guards are explicit contracts
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **DESIGN-AUDIT-10 · tarea 4A · planned**
  Fuente: declared border and active-filter cues exceed 3:1 against adjacent surfaces
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/responsive.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: declared border and active-filter cues exceed 3:1 against adjacent surfaces
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **DESIGN-AUDIT-11 · tarea 4A · planned**
  Fuente: synthetic starting task and all four stable greeting subtitles stay in Spanish
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.

## design-complete.test.mjs (12)

- **DESIGN-COMPLETE-01 · tarea 1A · planned**
  Fuente: theme defaults to system, tracks changes and explicit choices survive system changes
  Destino: `tests/component/theme-home.test.tsx`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-COMPLETE-02 · tarea 1A · planned**
  Fuente: no matchMedia still gives a usable explicit dark mode
  Destino: `tests/component/theme-home.test.tsx`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: El fallback sin matchMedia pertenece al proveedor de tema y se comprueba desde el shell, sin depender del editor.
- **DESIGN-COMPLETE-03 · tarea 3A · planned**
  Fuente: more options is a nonmodal disclosure with bound controls, toggling and Escape focus return
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-COMPLETE-04 · tarea 3A · planned**
  Fuente: outside click and tabbing outside close the disclosure without a focus trap
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-COMPLETE-05 · tarea 3A · planned**
  Fuente: closing on focus keeps the pending click target connected and actionable
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-COMPLETE-06 · tarea 4A · planned**
  Fuente: theme changes retain the editor node, raw invalid draft and field error state
  Destino: `tests/component/editor.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DESIGN-COMPLETE-07 · tarea 4A · planned**
  Fuente: mobile dropdown Escape does not close the navigation drawer, demo returns to disclosure trigger
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **DESIGN-COMPLETE-08 · tarea 4A · planned**
  Fuente: custom preview profile greets by name while public fixtures remain generic
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
- **DESIGN-COMPLETE-09 · tarea 4A · planned**
  Fuente: actual light and dark tokens meet declared text, field-border, filter and focus contrast contracts
  Destino: `tests/component/theme-home.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: actual light and dark tokens meet declared text, field-border, filter and focus contrast contracts
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **DESIGN-COMPLETE-10 · tarea 4A · planned**
  Fuente: six semantic rem roles, two radii, one editor edge and no unused font assets
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/responsive.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: six semantic rem roles, two radii, one editor edge and no unused font assets
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **DESIGN-COMPLETE-11 · tarea 6A · planned**
  Fuente: complete CSS parses with no repeated selector in the same conditional context
  Destino: `tests/component/theme-home.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: El parseo y las reglas de CSS completo se repiten con todos los módulos, incluido movimiento de 6A; el shell no representa el CSS final.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: complete CSS parses with no repeated selector in the same conditional context
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **DESIGN-COMPLETE-12 · tarea 4B · planned**
  Fuente: dark mode survives failed save, retry, archive confirmation and read-only task controls
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.

## draft.test.mjs (3)

- **DRAFT-01 · tarea 2A · planned**
  Fuente: raw temporal draft retains edits before validation and across re-render
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DRAFT-02 · tarea 2A · planned**
  Fuente: invalid temporal text survives validation failure
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **DRAFT-03 · tarea 2A · planned**
  Fuente: applying temporal fields does not mutate source entity
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## emil-skills.test.mjs (16)

- **EMIL-SKILLS-01 · tarea 4A · planned**
  Fuente: editing unrelated notes preserves all unresolved temporal errors
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-02 · tarea 4A · planned**
  Fuente: invalid-to-invalid retains its error and correction clears only resolved errors
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-03 · tarea 4A · planned**
  Fuente: changing a dependent time clears a date-required error without a new submit
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-04 · tarea 4A · planned**
  Fuente: note title validation survives body edits and ends when the title is valid
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-05 · tarea 4A · planned**
  Fuente: mobile temporal errors survive closing Time and editing the draft
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-06 · tarea 4B · planned**
  Fuente: closing conflict names Close and archive, keeps the shift open, and retries
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-07 · tarea 2A · planned**
  Fuente: simulated adapter conflict identifies its type without prescribing Save
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-08 · tarea 4B · planned**
  Fuente: one pending task has singular copy in Agenda and close confirmation
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-09 · tarea 4B · planned**
  Fuente: plausible long multilingual labels remain literal and retain identity
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.
- **EMIL-SKILLS-10 · tarea 4A · planned**
  Fuente: schema-backed title extremes round-trip through the actual adapter
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-11 · tarea 6A · planned**
  Fuente: documented v5 motion values are the single timing source
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: documented v5 motion values are the single timing source
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **EMIL-SKILLS-12 · tarea 6A · planned**
  Fuente: rapid feedback retargets from current painted state before cancellation
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: rapid feedback retargets from current painted state before cancellation
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **EMIL-SKILLS-13 · tarea 3A · planned**
  Fuente: viewport safe areas opt in without disabling user zoom
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **EMIL-SKILLS-14 · tarea 4A · planned**
  Fuente: touch changes target controls and coarse pointers without suppressing text selection globally
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **EMIL-SKILLS-15 · tarea 4B · planned**
  Fuente: long labels reserve trailing controls rather than truncating their identity
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: long labels reserve trailing controls rather than truncating their identity
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **EMIL-SKILLS-16 · tarea 4A · planned**
  Fuente: active backgrounds win the inherited hover cascade for ordinary and selected controls
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## history.test.mjs (10)

- **HISTORY-01 · tarea 4A · planned**
  Fuente: initial load replaces the first history entry and never pushes
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-02 · tarea 4A · planned**
  Fuente: opening a task pushes one entry and re-rendering does not duplicate it
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-03 · tarea 4A · planned**
  Fuente: document title names the open task and Home
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-04 · tarea 4A · planned**
  Fuente: popstate to the Home state returns to Home without pushing another entry
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-05 · tarea 4A · planned**
  Fuente: popstate to a task state restores that task without pushing during its render
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-06 · tarea 4B · planned**
  Fuente: Back with the More options menu or a dialog open closes it and keeps every Forward entry
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: Además del controlador y editor requiere el diálogo real de renombrar cama, creado en 4B.
- **HISTORY-07 · tarea 4A · planned**
  Fuente: Back while a completion save is pending keeps the view and the Forward entries
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-08 · tarea 4A · planned**
  Fuente: unsaved changes: Volver stays put, Descartar repeats the original Back once, no entries are added or lost
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-09 · tarea 4A · planned**
  Fuente: unsaved changes on Forward: Descartar repeats the Forward move, not a Back
  Destino: `tests/unit/history-controller.test.ts`, `tests/e2e/history.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 2B; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: El controlador se prueba en 2B con harness; el requisito fuente se cierra con App, editor, navegación y guardas de borrador integrados en 4A.
- **HISTORY-10 · tarea 4A · planned**
  Fuente: IME composition: Enter while composing neither saves nor is cancelled, and line breaks are normalised at compositionend
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## home-subtitle.test.mjs (3)

- **HOME-SUBTITLE-01 · tarea 1A · planned**
  Fuente: home subtitle catalogue has four independent short messages without name interpolation
  Destino: `tests/unit/home-subtitle.test.ts`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **HOME-SUBTITLE-02 · tarea 1A · planned**
  Fuente: injected random deterministically reaches each subtitle and is sampled only once
  Destino: `tests/unit/home-subtitle.test.ts`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **HOME-SUBTITLE-03 · tarea 1A · planned**
  Fuente: out-of-range or invalid random samples cannot produce an undefined subtitle
  Destino: `tests/unit/home-subtitle.test.ts`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## interface-skills.test.mjs (33)

- **INTERFACE-SKILLS-01 · tarea 5A · planned**
  Fuente: closed temporal validation identifies and opens the first invalid field
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **INTERFACE-SKILLS-02 · tarea 4A · planned**
  Fuente: mobile validation brings the invalid field into the visible Time drawer
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-03 · tarea 4A · planned**
  Fuente: closing desktop Time returns focus to its visible trigger
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-04 · tarea 4A · planned**
  Fuente: checkbox completion restores its focus identity on success and failure
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-05 · tarea 4A · planned**
  Fuente: completing the last focused pending checkbox has a safe fallback
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-06 · tarea 4B · planned**
  Fuente: close shift failure can be retried in the same dialog
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-07 · tarea 4A · planned**
  Fuente: simulated conflict offers retry without reloading or dropping the draft
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-08 · tarea 4A · planned**
  Fuente: filtered empty state escapes query and clears filters without dropping draft
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-09 · tarea 4A · planned**
  Fuente: note body uses its visible label as its accessible name
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-10 · tarea 4A · planned**
  Fuente: mobile input, wrapping and overlay CSS constraints are explicit
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: mobile input, wrapping and overlay CSS constraints are explicit
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **INTERFACE-SKILLS-11 · tarea 4B · planned**
  Fuente: renaming an empty group name identifies the field and permits correction
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-12 · tarea 4B · planned**
  Fuente: creating an empty title identifies the field and permits correction
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-13 · tarea 4B · planned**
  Fuente: invalid save-and-continue closes confirmation and returns to the invalid field
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-14 · tarea 4A · planned**
  Fuente: checkbox completion does not steal focus from a newer input
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-15 · tarea 7A · planned**
  Fuente: icons are CSS masks painted with currentColor so forced-colors mode keeps them visible
  Destino: `tests/e2e/accessibility.spec.ts`, `tests/e2e/offline-theme.spec.ts`.
  Preparación: 7A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A, 7A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: SVG lucide-react visible con contraste adecuado en forced-colors claro y oscuro; no transmitir significado solo con icono; control con nombre accesible e icono decorativo cuando corresponde.
  Equivalencia propuesta: Sustituir CSS masks por SVG inline de lucide-react es cambio de implementación aceptable solo con equivalencia observable. No exigir masks, currentColor de autor ni algoritmo WAAPI.
- **INTERFACE-SKILLS-16 · tarea 3A · planned**
  Fuente: toolbar keeps its trailing actions from being pushed out by a long bed name
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-17 · tarea 3A · planned**
  Fuente: demo controls live in the More options menu, hidden until it is opened
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-18 · tarea 3A · planned**
  Fuente: sidebar task tree shows a scroll cue only while more content is below
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-19 · tarea 3A · planned**
  Fuente: mobile-native rules stop tap flash, text inflation and iOS press callouts
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-20 · tarea 6A · planned**
  Fuente: CSS motion stays under 300ms and never transitions all properties
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: CSS motion stays under 300ms and never transitions all properties
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **INTERFACE-SKILLS-21 · tarea 6A · planned**
  Fuente: reduced motion keeps colour transitions and only removes smooth scrolling
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: reduced motion keeps colour transitions and only removes smooth scrolling
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **INTERFACE-SKILLS-22 · tarea 4A · planned**
  Fuente: Motivo and Prioridad are named by visible wrapping labels with no fixed widths
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **INTERFACE-SKILLS-23 · tarea 4A · planned**
  Fuente: title is a wrapping textarea: Enter adds no line and pasted newlines become spaces
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **INTERFACE-SKILLS-24 · tarea 4B · planned**
  Fuente: renamed copy: beds are cama, task notes and quick-note bodies have specific labels, shift entry names the current shift
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-25 · tarea 4A · planned**
  Fuente: high priority is named in the task row and agenda while normal priority is not
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-26 · tarea 4A · planned**
  Fuente: every completion checkbox sits in a 44px label hit area and one change completes the task once
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-27 · tarea 4A · planned**
  Fuente: disclosure summaries rely on the native open state without duplicate ARIA
  Destino: `tests/component/time-panel.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Collapsible expone estado expandido/control asociado una vez, abre inmediatamente y al cerrar elimina tabulación/interacción de contenido oculto; devuelve foco a trigger visible sin perder raw draft.
  Equivalencia propuesta: Sustitución propuesta: details/summary nativos por Base UI Collapsible. Conservar semántica y resultado, no markup nativo ni atributos redundantes.
- **INTERFACE-SKILLS-28 · tarea 4A · planned**
  Fuente: long words wrap with break-word, never anywhere
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/responsive.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: long words wrap with break-word, never anywhere
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **INTERFACE-SKILLS-29 · tarea 4A · planned**
  Fuente: Enter in the title saves a dirty draft through the form submit path and inserts no line
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-30 · tarea 4A · planned**
  Fuente: Enter in a clean title does not submit anything
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-31 · tarea 7A · planned**
  Fuente: every rendered icon resolves against index.html to a file on disk, and the stylesheet never references icon URLs
  Destino: `tests/e2e/accessibility.spec.ts`, `tests/e2e/offline-theme.spec.ts`.
  Preparación: 7A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A, 7A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Todos los iconos SVG quedan embebidos en el bundle/HTML autónomo, sin red ni referencias rotas; iconos decorativos ocultos a AT y controles con nombre accesible correcto.
  Equivalencia propuesta: El test original requiere archivo de icono en disco; lucide-react usa SVG inline. Reemplazar por verificación del HTML/bundle ejecutado sin red, no mantener existencia de archivos SVG separados.
- **INTERFACE-SKILLS-32 · tarea 3A · planned**
  Fuente: narrow toolbar keeps Cerrar turno as an icon button with its accessible name
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **INTERFACE-SKILLS-33 · tarea 3A · planned**
  Fuente: sidebar shift actions stack in one column so no label wraps in the 212px sidebar
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## motion.test.mjs (6)

- **MOTION-01 · tarea 6A · planned**
  Fuente: pointer screen transition is gentle and never begins invisible
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: pointer screen transition is gentle and never begins invisible
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **MOTION-02 · tarea 6A · planned**
  Fuente: screen entrance is opacity-only and drawer uses its own easing
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **MOTION-03 · tarea 6A · planned**
  Fuente: keyboard never starts transitions and reduced pointer motion keeps only a short opacity fade
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: keyboard never starts transitions and reduced pointer motion keeps only a short opacity fade
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **MOTION-04 · tarea 6A · planned**
  Fuente: reduced motion never animates a transform-only tab marker
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: reduced motion never animates a transform-only tab marker
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **MOTION-05 · tarea 6A · planned**
  Fuente: interruption cancels previous animation and reduced motion cancels active animation
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: interruption cancels previous animation and reduced motion cancels active animation
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **MOTION-06 · tarea 6A · planned**
  Fuente: missing animation API keeps content available without throwing
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: missing animation API keeps content available without throwing
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.

## polish.test.mjs (13)

- **POLISH-01 · tarea 6A · planned**
  Fuente: disclosure opens native state immediately and reveals only its content
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-02 · tarea 6A · planned**
  Fuente: disclosure close is instant, inert and restores focus outside hidden controls
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-03 · tarea 6A · planned**
  Fuente: repeated disclosure reversals and cancellation never write visibility or inline styles
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-04 · tarea 6A · planned**
  Fuente: disclosure keyboard, reduced preference and missing WAAPI keep native controls usable
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: disclosure keyboard, reduced preference and missing WAAPI keep native controls usable
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **POLISH-05 · tarea 6A · planned**
  Fuente: changing reduced preference cancels disclosure without rolling back intent
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-06 · tarea 6A · planned**
  Fuente: retiring a DOM subtree cancels its animations and finished effects leave no styles
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **POLISH-07 · tarea 6A · planned**
  Fuente: tab marker uses only transform for 150 ms and skips keyboard or unchanged position
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-08 · tarea 2A · planned**
  Fuente: civil date is evaluated in Santiago rather than UTC at midnight boundaries
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **POLISH-09 · tarea 2A · planned**
  Fuente: tomorrow calendar arithmetic handles month/year/leap boundaries without 24-hour assumptions
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **POLISH-10 · tarea 2A · planned**
  Fuente: agenda groups Hoy, Mañana, later dates and undated tasks without mutating data
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **POLISH-11 · tarea 2A · planned**
  Fuente: agenda handles empty and only-undated lists, including empty date strings
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **POLISH-12 · tarea 6A · planned**
  Fuente: external native close cancels outstanding reveal and returns focus without delaying state
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La funcionalidad de disclosure/tabs se prueba en 4A; tiempos, cancelación, continuidad y movimiento real se cierran tras implementar motion-policy/CSS en 6A.
- **POLISH-13 · tarea 6A · planned**
  Fuente: synchronizing own toggle does not cancel its chevron animation
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## preview.test.mjs (20)

- **PREVIEW-01 · tarea 2A · planned**
  Fuente: date-only is dd/mm/yyyy and leap days validated
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-02 · tarea 2A · planned**
  Fuente: snapshots are detached
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-03 · tarea 2A · planned**
  Fuente: save accepts literal title and increments version
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-04 · tarea 2A · planned**
  Fuente: save rejects blank title without changing state
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-05 · tarea 2A · planned**
  Fuente: version conflict preserves confirmed state
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-06 · tarea 2A · planned**
  Fuente: simulated failed save does not commit
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-07 · tarea 2A · planned**
  Fuente: close preserves pending tasks and notes; opening is empty
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-08 · tarea 2A · planned**
  Fuente: quick note has no shift or bed fields
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-09 · tarea 2A · planned**
  Fuente: cannot create a task without an open shift or cross-link a bed
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-10 · tarea 2A · planned**
  Fuente: archive is read only
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-11 · tarea 2A · planned**
  Fuente: only one active shift in preview
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-12 · tarea 2A · planned**
  Fuente: new bed and task are linked to active shift
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-13 · tarea 2A · planned**
  Fuente: note save is independent and ignores foreign linkage fields
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-14 · tarea 2A · planned**
  Fuente: time requires date and accepts 24-hour format
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-15 · tarea 2A · planned**
  Fuente: close repetition preserves the same result
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-16 · tarea 2A · planned**
  Fuente: renameBed changes only the label and preserves IDs, shift and all task relations
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-17 · tarea 2A · planned**
  Fuente: duplicate group names do not merge stable identities or task membership
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-18 · tarea 2A · planned**
  Fuente: renameBed rejects invalid labels and missing groups without changing the snapshot
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-19 · tarea 2A · planned**
  Fuente: renameBed failure leaves label and relationships unchanged; retry can succeed
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **PREVIEW-20 · tarea 2A · planned**
  Fuente: archived group cannot be renamed even after opening a new active shift
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## toasts.test.mjs (22)

- **TOASTS-01 · tarea 5A · planned**
  Fuente: expanded stack retains distinct messages and labels severity without a live list
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-02 · tarea 5A · planned**
  Fuente: duplicates reuse the same DOM node and make a repeated announcement distinct
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Conservar foco, selección/caret, undo, composición IME, raw draft y scroll durante actualizaciones que no cambian selección; una sola instancia interactiva del control.
  Equivalencia propuesta: La identidad DOM es un medio para preservar experiencia, no licencia para perder caret/undo aunque el valor se restaure desde store. Verificar también navegador real.
- **TOASTS-03 · tarea 5A · planned**
  Fuente: untrusted message text is not HTML
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-04 · tarea 6A · planned**
  Fuente: notify never steals focus and messages persist beyond the animation window
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
- **TOASTS-05 · tarea 5A · planned**
  Fuente: close of a focused middle toast moves to the following close button
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-06 · tarea 5A · planned**
  Fuente: closing a toast without focus does not move unrelated focus
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-07 · tarea 6A · planned**
  Fuente: pointer dismissal becomes inert immediately and removes after the 300ms exit
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
- **TOASTS-08 · tarea 6A · planned**
  Fuente: repeat during exit reverses on the same card and cancels stale removal
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
- **TOASTS-09 · tarea 6A · planned**
  Fuente: keyboard and initial reduced motion dismiss synchronously
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: keyboard and initial reduced motion dismiss synchronously
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-10 · tarea 6A · planned**
  Fuente: keyboard interruption removes pending exits and cancels pending FLIP frames
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: keyboard interruption removes pending exits and cancels pending FLIP frames
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-11 · tarea 6A · planned**
  Fuente: enabling reduced motion settles every pending exit immediately
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: enabling reduced motion settles every pending exit immediately
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-12 · tarea 6A · planned**
  Fuente: FLIP captures painted position before layout mutation and cancels old frames
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: FLIP captures painted position before layout mutation and cancels old frames
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-13 · tarea 5A · planned**
  Fuente: shortcut focuses latest without automatic focus, Escape closes only within stack
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-14 · tarea 5A · planned**
  Fuente: modal suspension hides controls and defers a new announcement until it closes
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-15 · tarea 6A · planned**
  Fuente: clear and modal interruptions cannot revive a removed toast
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
- **TOASTS-16 · tarea 5A · planned**
  Fuente: new arrivals preserve scroll while reading, but follow latest when already at bottom
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-17 · tarea 5A · planned**
  Fuente: a long stack retains errors and has an explicit scroll budget, not eviction
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **TOASTS-18 · tarea 6A · planned**
  Fuente: CSS gates transform and opacity motion, preserves screen durations and readable controls
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: CSS gates transform and opacity motion, preserves screen durations and readable controls
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-19 · tarea 6A · planned**
  Fuente: first duplicate height change retargets neighbouring cards through FLIP
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: first duplicate height change retargets neighbouring cards through FLIP
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-20 · tarea 6A · planned**
  Fuente: modal suspension disables entry transitions without toggling list display
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: modal suspension disables entry transitions without toggling list display
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-21 · tarea 6A · planned**
  Fuente: bottom scroll adjustment is measured as part of the FLIP mutation
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/unit/motion-policy.test.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La pila se migra en 5A; las garantías que incluyen entradas/salidas, interrupciones y movimiento se revalidan y cierran en 6A con la política final integrada.
  Resultado de v6: Preservar política de movimiento/interrupción observable: bottom scroll adjustment is measured as part of the FLIP mutation
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **TOASTS-22 · tarea 5A · planned**
  Fuente: dismissing the latest announcement clears its live text without removing other cards
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## tokens.test.mjs (2)

- **TOKENS-01 · tarea 1A · planned**
  Fuente: the shared solid and on-solid tokens are defined on :root for light and dark themes
  Destino: `tests/component/theme-home.test.tsx`.
  Preparación: 1A; integración: 1A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: the shared solid and on-solid tokens are defined on :root for light and dark themes
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.
- **TOKENS-02 · tarea 3A · planned**
  Fuente: the brand label keeps its visually hidden text rule
  Destino: `tests/component/theme-home.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/component/navigation.test.tsx`, `tests/e2e/overlays.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La etiqueta de marca visualmente oculta se verifica en Navigation real, creada en 3A, no solo en tokens.
  Regresión final: `tests/e2e/accessibility.spec.ts`.
  Resultado de v6: Preservar resultado visual/accesible del contrato fuente: the brand label keeps its visually hidden text rule
  Equivalencia propuesta: Las regex o el parser de CSS de v5 son evidencia estructural. Mantener comprobaciones de tokens pertinentes y añadir estilos calculados/contraste/layout de navegador; no exigir mismos selectores ni tomar parsing como QA visual.

## ui.test.mjs (43)

- **UI-01 · tarea 1A · planned**
  Fuente: home has greeting, one state summary action and no date input
  Destino: `tests/component/theme-home.test.tsx`, `tests/e2e/offline-theme.spec.ts`.
  Preparación: 1A; integración: 1A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-02 · tarea 4A · planned**
  Fuente: temporal draft survives folding beds and invalid save
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-03 · tarea 4A · planned**
  Fuente: mobile drawer contains only one temporal control instance
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-04 · tarea 4A · planned**
  Fuente: mobile bed fold updates visible drawer
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-05 · tarea 4A · planned**
  Fuente: editing is locked during pending save
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-06 · tarea 4A · planned**
  Fuente: unsaved selection cancellation keeps draft
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-07 · tarea 4A · planned**
  Fuente: save error keeps body and is not successful save
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-08 · tarea 4A · planned**
  Fuente: title and body markup are rendered as text
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-09 · tarea 4B · planned**
  Fuente: new task is editable after confirmed create
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-10 · tarea 4B · planned**
  Fuente: close archives pending tasks and new shift starts empty
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-11 · tarea 4A · planned**
  Fuente: mobile raw temporal field is saved after drawer dismissal
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-12 · tarea 3A · planned**
  Fuente: native Escape cancel closes drawer and restores background navigation
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-13 · tarea 4A · planned**
  Fuente: saved task can switch selection without draft warning
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-14 · tarea 4A · planned**
  Fuente: Home greeting node survives opening and closing Time
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
- **UI-15 · tarea 4A · planned**
  Fuente: filter preserves current editor and navigation scroll position
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **UI-16 · tarea 6A · planned**
  Fuente: pointer animates a view change but not routine filter updates
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: pointer animates a view change but not routine filter updates
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **UI-17 · tarea 4A · planned**
  Fuente: Cancel resets all visible controls and save status after direct edits
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-18 · tarea 3A · planned**
  Fuente: failed sidebar completion restores confirmed checkbox state
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-19 · tarea 4A · planned**
  Fuente: cancelling draft navigation restores sidebar checkbox state
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **UI-20 · tarea 4A · planned**
  Fuente: Time from Home selects Agenda; Task without a selection explains its empty state
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-21 · tarea 4A · planned**
  Fuente: tabs retain raw temporal draft and open disclosure across panel replacement
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-22 · tarea 6A · planned**
  Fuente: tabs have distinct related panels and roving keyboard wraps without animating content
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: Tabs/disclosure funcionales se prueban en 4A; la condición sin animación de contenido o de toggle externo se cierra con movimiento final en 6A.
- **UI-23 · tarea 6A · planned**
  Fuente: pointer tabs animate marker only and routine render does not replay it
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: pointer tabs animate marker only and routine render does not replay it
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.
- **UI-24 · tarea 6A · planned**
  Fuente: native disclosure toggle synchronizes open state and inert without animation
  Destino: `tests/component/time-panel.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: Tabs/disclosure funcionales se prueban en 4A; la condición sin animación de contenido o de toggle externo se cierra con movimiento final en 6A.
  Resultado de v6: Collapsible expone estado expandido/control asociado una vez, abre inmediatamente y al cerrar elimina tabulación/interacción de contenido oculto; devuelve foco a trigger visible sin perder raw draft.
  Equivalencia propuesta: Sustitución propuesta: details/summary nativos por Base UI Collapsible. Conservar semántica y resultado, no markup nativo ni atributos redundantes.
- **UI-25 · tarea 4A · planned**
  Fuente: Agenda includes undated tasks regardless of navigation filter and shows selected completed state
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **UI-26 · tarea 5A · planned**
  Fuente: visible feedback uses one live announcement and can be dismissed without losing a draft
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-27 · tarea 5A · planned**
  Fuente: validation is associated with the invalid field without duplicate live alert
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **UI-28 · tarea 5A · planned**
  Fuente: rapid repeated checkbox change commits once without an artificial conflict
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **UI-29 · tarea 4B · planned**
  Fuente: empty shift Agenda offers a useful no-date hint without making tasks or a calendar
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: El escenario fuente cierra y abre turno mediante diálogo y formulario antes de observar Agenda vacía; se cierra en 4B con ese ciclo real, no con un fixture que omita las acciones.
- **UI-30 · tarea 5A · planned**
  Fuente: dismissing focused feedback restores a safe focus target without stealing unrelated focus
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-31 · tarea 4B · planned**
  Fuente: rename group is keyboard-labelled, prefills its name and updates navigation, metadata and Agenda
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-32 · tarea 4B · planned**
  Fuente: cancelling rename leaves group and task selection unchanged
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-33 · tarea 4B · planned**
  Fuente: invalid rename keeps entered value and error in the open modal
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-34 · tarea 4B · planned**
  Fuente: rename failure preserves name draft and repeated submit is blocked while pending
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-35 · tarea 4B · planned**
  Fuente: renaming a group respects dirty task cancellation and explicit discard
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-36 · tarea 5A · planned**
  Fuente: rename noop does not consume a pending simulated failure or announce a change
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **UI-37 · tarea 4B · planned**
  Fuente: archived view does not expose editable group controls
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-38 · tarea 4B · planned**
  Fuente: invalid save-and-continue never opens rename or loses raw draft; next navigation is independent
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-39 · tarea 4B · planned**
  Fuente: successful save-and-continue opens rename after saving the task draft
  Destino: `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4B; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **UI-40 · tarea 4A · planned**
  Fuente: only Home subtitle varies per load; name and subtitle remain stable through Time and navigation
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
- **UI-41 · tarea 4A · planned**
  Fuente: home summary reports the open shift and its pending count, and the greeting stays stable through Time and navigation
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
- **UI-42 · tarea 4B · planned**
  Fuente: home summary uses singular pending copy and the start action when no shift is open
  Destino: `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`.
  Preparación: 4A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.
- **UI-43 · tarea 5A · planned**
  Fuente: new field validation does not discard previously unread stacked feedback
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## validation.test.mjs (2)

- **VALIDATION-01 · tarea 2A · planned**
  Fuente: validation distinguishes fields in the same semantic family
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **VALIDATION-02 · tarea 2A · planned**
  Fuente: civil date validation, date dependency, valid boundaries and note isolation
  Destino: `tests/unit/format.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/draft.test.ts`, `tests/unit/preview.test.ts`.
  Preparación: 2A; integración: 2A; evidencia de cierre: nonvisual.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.

## viewport.test.mjs (11)

- **VIEWPORT-01 · tarea 4B · planned**
  Fuente: fluid shell, centered editor and archive share bounded declared sizing
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/domain-dialogs.test.tsx`, `tests/e2e/shift-lifecycle.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B; evidencia de cierre: browser.
  Dependencia: La observación completa incluye cierre/archivo, renombrar cama o controles de solo lectura creados en 4B; 3A/4A solo preparan parte del flujo.
- **VIEWPORT-02 · tarea 5A · planned**
  Fuente: Time fullscreen docking preserves raw errors, focus, scroll and body through cycles
  Destino: `tests/e2e/responsive.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **VIEWPORT-03 · tarea 5A · planned**
  Fuente: navigation restores content, scroll and focus at 699 to 700
  Destino: `tests/e2e/responsive.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **VIEWPORT-04 · tarea 4A · planned**
  Fuente: Agenda docks at 1000 but remains in drawer at 999
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **VIEWPORT-05 · tarea 4A · planned**
  Fuente: narrowing moves focus from hidden inline columns to their visible buttons
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **VIEWPORT-06 · tarea 5A · planned**
  Fuente: confirmation and unsaved draft survive resize and fullscreen events
  Destino: `tests/e2e/responsive.spec.ts`, `tests/unit/notification-store.test.ts`, `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: El flujo de edición/layout/diálogo se repite con NotificationStack real: suspensión, ausencia de anuncio duplicado o error anunciado no se acreditan antes de 5A.
- **VIEWPORT-07 · tarea 4A · planned**
  Fuente: Home keeps Time overlay and greeting identity on wide screens
  Destino: `tests/unit/home-subtitle.test.ts`, `tests/component/theme-home.test.tsx`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 1A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Home/tokens se ensayan en 1A, pero la identidad completa exige store, navegación, editor y Tiempo/Agenda reales montados juntos.
- **VIEWPORT-08 · tarea 4A · planned**
  Fuente: explicit hidden inspector keeps preference and its open mobile drawer
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **VIEWPORT-09 · tarea 4A · planned**
  Fuente: docking preserves theme, filters, selected task and expanded property
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
- **VIEWPORT-10 · tarea 4A · planned**
  Fuente: same-band pixel and fullscreen events do not remount controls
  Destino: `tests/e2e/responsive.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
  Resultado de v6: Conservar foco, selección/caret, undo, composición IME, raw draft y scroll durante actualizaciones que no cambian selección; una sola instancia interactiva del control.
  Equivalencia propuesta: La identidad DOM es un medio para preservar experiencia, no licencia para perder caret/undo aunque el valor se restaure desde store. Verificar también navegador real.
- **VIEWPORT-11 · tarea 6A · planned**
  Fuente: temporal-only dirty transition preserves body, form, scroll and current save state
  Destino: `tests/unit/motion-policy.test.ts`, `tests/e2e/motion.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 6A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
  Resultado de v6: Preservar política de movimiento/interrupción observable: temporal-only dirty transition preserves body, form, scroll and current save state
  Equivalencia propuesta: Permitir CSS y APIs públicas de Base UI/Sonner en lugar de WAAPI/FLIP manual. Comprobar estado actual, continuidad visual, cancelación, duración, modalidad y reduced-motion; no exigir mismo algoritmo.

## visibility.test.mjs (5)

- **VISIBILITY-01 · tarea 3A · planned**
  Fuente: selected Home retains dark background with white foreground on hover
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **VISIBILITY-02 · tarea 3A · planned**
  Fuente: primary action retains contrasting dark hover
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: El contrato genérico de hover primario se verifica sobre el botón primario real de Home disponible en 3A; no exige el contexto Guardar de la fixture estática fuente. La revisión comprueba contraste calculado sobre ese control real; Guardar se revalida al integrar editor y al cierre final.
- **VISIBILITY-03 · tarea 3A · planned**
  Fuente: active filter keeps selected background on hover
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **VISIBILITY-04 · tarea 5A · planned**
  Fuente: live notification regions remain mounted and are not hidden while empty
  Destino: `tests/component/notifications.test.tsx`, `tests/e2e/notifications.spec.ts`.
  Preparación: 5A; integración: 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A; evidencia de cierre: browser.
  Dependencia: La fase de cierre conserva el contrato fuente completo; cualquier ensayo anterior solo acredita su alcance declarado.
- **VISIBILITY-05 · tarea 4A · planned**
  Fuente: selected tabs do not take the hover background while unselected tabs still do
  Destino: `tests/component/navigation.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/overlays.spec.ts`, `tests/component/editor.test.tsx`, `tests/component/time-panel.test.tsx`, `tests/component/agenda.test.tsx`, `tests/e2e/editor.spec.ts`.
  Preparación: 3A; integración: 1A, 1B, 2A, 2B, 3A, 4A; evidencia de cierre: browser.
  Dependencia: Layout/primitivas se ensayan en 3A; la observación íntegra incluye editor, campos, tabs o Agenda reales de 4A, no slots ni fixtures sustitutivos.
