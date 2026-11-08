# Lecciones incorporadas a la planificación y ejecución

Estos controles forman parte del método de migración solicitado. No certifican producto ni aceptan las precisiones de UX pendientes. Complementan los 212 requisitos de paridad sin atribuir escenarios nuevos a pruebas antiguas. Las [fuentes estudiadas](CASOS_REALES.md) sustentan riesgos, no resultados de Turno.

## Cómo planificar una tarea

1. Leer la fase y los casos fuente que posee. Consultar [migration-risks.json](migration-risks.json) y seleccionar los controles `EXTRA-*` de esa fase. Incluir sus IDs, escenarios y oráculos en el brief, no solo el enlace al artículo.
2. Declarar qué módulo es dueño de snapshot, borrador, navegación, overlays y suscripciones. Una tarea no introduce un segundo dueño ni hace que v5 y React controlen el mismo DOM.
3. Definir test primero, evidencia que lo haría fallar y artefacto estable anterior al que volver si el candidato falla. Separar el tiempo de demo simulado de coste de render/interacción.
4. Reutilizar casos y evidencia existentes cuando ya cubran el riesgo: no duplicar suites o reuniones por cada fuente. Añadir solo la prueba que falte. Registrar los IDs adicionales ejecutados en `additionalRequirements` y en los `testCases` del gate correspondiente.

## Controles y criterios observables

### EXTRA-LIFECYCLE-ASYNC · fases 1B, 2A y 2B

Origen: montaje/cleanup de Preply y wrappers de Heap. En el fixture de composición y los controladores, repetir **20 ciclos de montaje/desmontaje**, además del ciclo extra de StrictMode. Contabilizar listeners/suscripciones activas antes y después: vuelven al valor de partida al desmontar. Una navegación o guardado del usuario produce una sola operación de dominio; el sorteo de saludo y la sesión no se duplican por render.

Resolver de forma controlada una respuesta de la selección anterior después de editar otra tarea: no debe sobrescribir su borrador, foco ni errores. RED debe reproducir duplicación o respuesta obsoleta, no falta de instalación. Evidencia: unit/component para contadores y operaciones; navegador para foco real. Gates G1B/G2A/G2B, no un gate adicional de aprobación.

### EXTRA-STATE-AUTHORITY · fases 2A y 4A

Origen: convivencia de sistemas en Heap y fronteras de Slack. Registrar un dueño por estado y comprobar guardado exitoso, fallido, conflicto y respuesta tardía. Tras fallo/conflicto, el snapshot confirmado conserva sus valores previos y el borrador crudo conserva el texto que el usuario editaba. Confirmar una sola mutación por acción y ninguna escritura de persistencia/red en la demo.

La revisión verifica la tabla de ownership frente al código, no solo su existencia. Evidencia: tests de store/edición con promesas controladas y snapshots antes/después. Gates G2A/G4A.

### EXTRA-NATIVE-EDIT · fases 1B, 3A, 4A y 7B

Origen: recuperación de capacidades nativas en GitHub y cambios de montaje de Preply. Con texto largo/literal y borrador inválido, cruzar 699↔700 y 999↔1000, abrir/cerrar overlays y cambiar tema: debe existir **una sola instancia interactiva de cada campo**. Caret/selección, raw, errores y undo se conservan si la acción no cambia selección. Verificar copiar/pegar, Tab/Escape, Atrás/Adelante y destino visible del foco al cerrar.

En 1B probar tema claro/oscuro/sistema con Dialog/Popover/avisos abiertos, también en portales a body: tokens computados, contraste y foco válidos. Context del mismo árbol cruza portales, no roots independientes. Un root principal evita introducir esa frontera. Evidencia de navegador para edición/foco/undo y composición de tema. Composición por eventos no cierra IME real; el recorrido de composición con candidatos y posterior Enter se registra manualmente en G7B. No se exige un algoritmo DOM concreto si el comportamiento es equivalente. Gates G3/G4A/G7B.

### EXTRA-PERFORMANCE-FLOWS · fases 1A y 7A

Origen: resultados distintos por interacción en Slack y experiencia de GitHub con archivos grandes. Comparar el **HTML autónomo v5 generado por build_preview.py** con el **build de producción v6**, sin dev server de desarrollo, en el mismo motor/equipo, viewport, tema y datos sintéticos. Separar arranque, abrir/cambiar tarea, filtrar, guardar y presentar 30 avisos; no resumirlos en una sola media.

Registrar **20 muestras por flujo**, p50/p95 y bytes brutos/gzip, separando arranque frío y navegación caliente. Hacer tres recorridos del baseline para observar su variabilidad. Identificar la latencia artificial del adaptador y presentar tanto el tiempo total como el tramo de UI cuando sea medible, sin ocultar el primero. El fixture vacío no sustituye datos equivalentes. En 1A se mide solo el shell disponible; la comparación de todos los flujos se completa en 7A.

Antes de medir el candidato, documentar fixture, número de muestras y criterio de comparación sobre la variabilidad observada del baseline. No se inventa un SLA ni se trasladan cifras de otro producto: una regresión fuera del criterio fijado requiere diagnóstico y corrección, o aceptación explícita del tradeoff, antes de cerrar el gate afectado. Si falta ese criterio, el resultado queda pendiente. La alerta de bundle 2× de G1A sigue siendo una propuesta del plan. Si no hay navegador permitido, resultado BLOCKED, nunca rendimiento PASS desde jsdom. Evidencia y decisión en G1A/G7A.

### EXTRA-OFFLINE-ARTIFACT · fases 1A y 7A

Origen: coherencia de versiones/artefactos en Slack offline. Registrar el hash del HTML final. En contexto de navegador limpio, abrir por `file://` sin red y recargar: app operativa, fuentes/iconos incluidos y **cero solicitudes a orígenes externos**. Contrastar tema/saludo y una edición/guardado de demo en la sesión nueva; recargar reinicia datos y tema de sesión como en v5.

Por HTTP, mantener disponible el servidor local que entrega el documento y bloquear dependencias externas: la app servida sigue operando en memoria. Esto no promete recarga si el servidor HTTP está inaccesible; sin Service Worker ni persistencia no existe ese contrato. Separar ambos escenarios en el reporte.

Probar el artefacto exacto que se entrega, no un dev server ni un navegador con recursos ya calentados. No añadir Service Worker, caché persistente ni flags para satisfacer esta prueba. El chequeo estático ayuda pero no la cierra. Gates G1A/G7A, navegador separado de build.

### EXTRA-ROLLBACK-PHASE · fases 0 y 7A

Origen: migraciones incrementales y fronteras pequeñas de los casos estudiados. Registrar SHA/hash del último artefacto estable disponible y el candidato, archivos permitidos y cómo volver a abrir la referencia anterior. Si G0 no está aprobado, se conserva como referencia identificada, **no se inventa una v5 certificada estable**.

Cada tarea mantiene alcance pequeño y recuperable. Ante FAIL/BLOCKED requerido, detener la fase dependiente y conservar referencia/candidato y diagnóstico. Verificar que los archivos v5 de producto/tests/assets no cambiaron. En el cierre agregado, documentar un ensayo en sandbox de reapertura del artefacto anterior y su hash, sin despliegue ni operación destructiva. No añadir feature flags o persistencia por este control. La vuelta al artefacto previo no promete conservar estado de sesión: la demo se reinicia al recargar.

## Ejecución y revisión

El implementador demuestra RED funcional, implementación mínima y GREEN sobre el árbol final. El revisor contrasta estado dueño, lifecycle, nativo y rendimiento/offline cuando correspondan, y registra el resultado en los gates ya existentes. Un campo JSON o la comprobación documental solo verifica trazabilidad; no ejecuta el escenario.

La aceptación de cada fase exige que sus controles aplicables tengan evidencia válida o una decisión explícita que resuelva el cambio de alcance. No se permite convertir un bloqueo en PASS por citar un caso de éxito. Backend/host siguen fuera de esta migración.
