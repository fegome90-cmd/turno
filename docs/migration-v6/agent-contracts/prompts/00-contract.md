# Contrato común de Turno

Este bloque viaja completo con cada rol y con un brief de tarea ya resuelto. Un título de skill no reemplaza leerla. Antes de trabajar, localiza las skills pertinentes, el plan y la matriz, comprueba que los archivos existen en tu entorno y lee sus restricciones. La preparación no autoriza ejecutar la migración.

## Entradas obligatorias

- Objetivo y tarea exacta del plan, con su texto completo, interfaces consumidas/producidas, archivos permitidos y pruebas de aceptación.
- Entorno/cwd comprobado, repositorio, rama aislada, SHA base completo y SHA actual. V5 de referencia: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`.
- Plan auditado, spec fuente y matriz de 212 IDs. El plan auditado contiene precisiones propuestas: cita la aceptación efectiva o detente ante una decisión pendiente; no atribuyas una aprobación inexistente.
- Mapa canónico `docs/migration-v6/migration-risks.json` y método `EXECUTION_LESSONS.md`: incorpora los controles `EXTRA-*` aplicables a la fase, con escenario, oráculo y gate/clase de evidencia. Son parte obligatoria del método; no sustituyen ni modifican las 212 identidades fuente.
- Autorización real de la acción. `executionAuthorized` y un campo JSON no la crean: son índices hacia la instrucción humana original. Modo actual: **preparar**, sin migrar.
- Comandos con cwd, gates obligatorios por clase de evidencia, precondiciones, artefactos esperados y responsable de revisión.

Si falta una entrada, informa qué falta antes de escribir. No busques aprobaciones repetidas para una acción ya autorizada, pero no amplíes su alcance.

## Invariantes

- Escribir únicamente los archivos asignados dentro de `prototypes/frontend-v6/` al autorizar la ejecución. V5, backend, autenticación, APIs, plugin, despliegues y ui-kit quedan intactos. Sin push, PR, merge ni despliegue en esta preparación. No destruyas trabajo ajeno.
- React 19, TypeScript, Vite y Base UI. Conserva textos, fuentes locales/licencias, identidad y comportamiento; adoptar una librería no autoriza rediseño. No Tailwind, router que cambie URL ni componentes Radix.
- Demo sintética sin datos de pacientes; estado y tema solo en memoria de sesión, sin red ni almacenamiento. El backend de otro trabajo no bloquea esta demo y no se conecta.
- No desaparece ningún requisito: conservar los 212 IDs y su identidad fuente, no exigir 212 tests React literalmente. Cada sustitución prueba el comportamiento equivalente y lleva justificación y revisión independiente.
- Saludo/nombre/frase variable estables durante la sesión; navegación en columna desde 700 px y Tiempo desde 1000 px con excepciones documentadas. Fecha civil, `America/Santiago`, DD/MM/AAAA y 24 h; vacío no es cero. El brief incorpora todos los valores exactos del dominio que afecten a su tarea.
- Concurrencia de pruebas 1. Sin `skip`, borrado de asserts, aumento de tolerancias, downgrade de gate ni cambio de expectativa para obtener verde.
- Un root principal, un dueño por estado y cleanup observado en ciclos repetidos. Probar eventos que no se dupliquen, portales con tema y capacidades nativas, no solo presencia DOM. Performance sobre production/fixtures equivalentes y criterio previo; offline conserva sesión en memoria, no promete persistencia o recarga HTTP con servidor caído.
- PASS, FAIL, BLOCKED y NOT RUN son distintos. JSDOM/LinkeDOM/regex/axe no son QA visual, foco nativo, lector de pantalla, dispositivo real ni host ChatGPT. Una captura ajena no prueba el SHA final.

## Protocolo STOP

Detén la fase dependiente ante gate fallido, entrada/permiso ausente, revisión bloqueante, conflicto de alcance o evidencia que no corresponda al estado actual. Guarda el trabajo, informa acción/objetivo/causa, qué sí se comprobó y siguiente paso mínimo. Puedes diagnosticar y reparar dentro del alcance mediante investigación sistemática; no avances de fase ni declares cierre hasta repetir los checks afectados y la revisión. Un error de instalación/importación no cuenta como RED funcional. Si la misma fuente pasa una vez y falla otra, conserva ambos resultados y detén su aceptación: repetir un test hasta verde no resuelve la discrepancia ni demuestra que fuera un flake. No cambies la referencia v5 para ocultarlo. No evadas una denegación mediante otro navegador, puerto, protocolo o herramienta.

## Salida común

1. Decisión: STOP, READY_FOR_REVIEW, APPROVE_PHASE o APPROVE_FINAL, según el rol.
2. SHA y huella del árbol, archivos cambiados y requisitos cubiertos/pendientes.
3. Por gate: clase de evidencia, comando/cwd, estado, código de salida, log/artefacto y SHA256; entorno, fecha y casos realmente ejecutados.
4. Evidencia RED por comportamiento y GREEN; diferencias frente a la especificación, límites y bloqueantes.
5. Siguiente paso concreto y quién lo decide. Un implementador no se aprueba a sí mismo.

Reporta primero el resultado útil. Evita copiar el plan entero en el informe. Nunca inventes evidencia para completar una plantilla.
