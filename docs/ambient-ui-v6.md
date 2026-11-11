# Turno · Captura y revisión v6 — UI antes de inferencia

**Estado:** implementación en la rama `feature/turno-capture-review-ui-v6` (PR #5), con base en `main` (interfaz React integrada por el PR #3). **No es una release.**

## Decisión explícita

Primero se prepara y prueba el recorrido completo de interfaz y estado. **No se invoca ningún LLM, no se simula su respuesta y no se usan datos clínicos reales.** El PR #4 (Strands/AI Gateway basado en v5) permanece separado. Este trabajo no pretende acreditar su integración en React v6.

## Qué funciona ahora

- La barra de herramientas permite abrir **Captura** y **Sugerencias** sin introducir un chat.
- Captura acepta **una tarea literal por línea**, sin extraer fechas, camas, prioridades ni significados. Las personas completan los campos manualmente.
- Cada tarea aparece como una tarjeta editable (título, lista del turno, fecha, hora y condición «antes del cierre») y **solo se escribe al presionar «Aprobar y guardar»**.
- El contrato `ReviewedTaskInput` entra por `TurnoPort.createReviewedTask`: validación en el cliente + revalidación atómica en el adaptador actual. No se crean tareas incompletas mediante operaciones consecutivas de creación y edición.
- Si se indica una hora, es obligatoria una fecha. La condición «antes del cierre» excluye fecha y hora y queda representada en el dominio. No se programa ninguna alarma.
- Los borradores sin guardar no se descartan al cerrar accidentalmente el diálogo.
- Las sugerencias muestran **únicamente hechos verificables en el snapshot actual**: varias tareas pendientes en la misma lista, fecha y hora; o tareas pendientes marcadas «antes del cierre». Una coincidencia no demuestra duplicación.
- Se puede revisar una tarea, descartar la sugerencia en la sesión actual y usar el panel en escritorio y móvil.
- Las sugerencias no se anuncian con un aviso global: quedan en el acceso voluntario «Sugerencias», con su contador. Los errores reales de guardado sí se siguen anunciando (paquete R1a de la hoja de ruta del agente).
- Se reutilizan el store de Zustand, navegación, sistema de capas, tema y avisos ya existentes.

## Lo que deliberadamente NO hace

No analiza lenguaje libre, no atribuye propuestas a modelos, no realiza llamadas API, no guarda secretos, no crea listas automáticamente, no prioriza clínicamente, no marca tareas completadas y no cierra el turno. Tampoco usa un background worker ni muestra mensajes inventados para aparentar inferencia.

**El frontend v6 del PR #3 es todavía una demo con un adaptador en memoria.** Una tarea guardada por este flujo existe en esa sesión de demostración, pero no persiste al recargar, ni tiene autenticación o backend productivo. El nuevo contrato deberá implementarse en el puerto autenticado definitivo antes de exponerlo a usuarios reales. No se utilizarán datos identificables de pacientes en esta fase.

## Tres tareas seleccionadas

Ingresar como líneas separadas:
- `Revisar tarea pendiente A`
- `Revisar tarea pendiente B`
- `Completar informe`

En revisión, asignar explícitamente fecha y 15:00 a las dos primeras; elegir la lista correcta desde Turno. La lista correspondiente a «cama 4» **no se crea ni se supone** (la demo actual solo tiene Lista 1 y Lista 2); deberá configurarse en Turno si se desea. Marcar la tercera «Antes del cierre» sin fecha/hora. Al guardar, el panel puede identificar coincidencia de horario y el pendiente de cierre de forma determinista.

## Contrato pendiente para IA

Cuando **toda la UI** esté aprobada, un worker Strands Agents remoto podrá solicitar propuestas a Vercel AI Gateway. Su salida deberá pasar por el **mismo** esquema de tarjetas, con origen verificable y validaciones existentes; un LLM nunca tendrá una herramienta que salte la revisión humana. No se conectarían claves al frontend: OIDC de Vercel o secreto del backend, según el despliegue definitivo.

**Punto bloqueante de integración futura:** autenticar identidad, autorizar el turno, idempotencia de comandos, protección contra versiones obsoletas, persistencia real, límites de longitud, minimización de datos y auditoría de acciones. La demo no acredita esos requisitos.

## Pruebas

- Unitarias: validación de fecha/hora/cama, condición de cierre, persistencia atómica del adaptador y sugerencias derivadas de tareas del puerto.
- Componentes: interacción React real, no creación sin aprobación, campos incompletos, confirmación y descarte.
- Chromium: recorrido completo desktop y móvil en el HTML construido, con bloqueo de peticiones externas; prueba sin acceso a modelos.
- Ejecutar desde `prototypes/frontend-v6`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:component`, `npm run build:e2e`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<Chrome> npx playwright test --project=chromium --workers=1` y, con `dist/` ya construido, `npm run check:portable`. Correr `typecheck` solo después de que `npm ci` haya terminado: si coincide con la instalación aparecen errores TS7016 falsos.

El control de cierre es un **gate de interfaz**, no aprobación para activar inferencia ni datos clínicos.
