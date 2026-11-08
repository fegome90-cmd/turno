# Contrato común de Turno

Este bloque viaja completo con cada rol y con un brief de tarea ya resuelto. Un título de skill no reemplaza leerla. Antes de trabajar, localiza las skills pertinentes, el plan y la matriz, comprueba que los archivos existen en tu entorno y lee sus restricciones. La preparación no autoriza ejecutar la migración.

## Entradas obligatorias

- Objetivo y tarea exacta del plan, con su texto completo, interfaces consumidas/producidas, archivos permitidos y pruebas de aceptación.
- Entorno/cwd comprobado, repositorio, rama aislada, SHA base completo y SHA actual. V5 de referencia: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`.
- Plan auditado, spec fuente y matriz de 212 IDs. El plan auditado contiene precisiones propuestas: cita la aceptación efectiva o detente ante una decisión pendiente; no atribuyas una aprobación inexistente.
- Mapa canónico `docs/migration-v6/migration-risks.json` y método `EXECUTION_LESSONS.md`: incorpora los controles `EXTRA-*` aplicables a la fase, con escenario, oráculo y gate/clase de evidencia. Son parte obligatoria del método; no sustituyen ni modifican las 212 identidades fuente.
- Investigación `docs/migration-v6/REACT_RESEARCH.md` del 08/11/2026: trasladar los controles aplicables de versiones/toolchain, inventario RSC/seguridad y portabilidad al brief y sus evidencias. Distinguir instalado, ensayado y propuesto. No activar Compiler/Oxc ni adoptar latest como efecto lateral. Estos criterios requieren revisión técnica: el checker no ejecuta auditorías ni demuestra compatibilidad, ausencia de RSC o seguridad de aplicación. Sí valida los dos reportes estructurados de dependencias descritos abajo.
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


## Auditoría estructurada de dependencias

`audit-total` y `audit-runtime` son gates `nonvisual`, separados de seguridad de aplicación. Son obligatorios para cualquier decisión READY/APPROVE en todas las fases de producto 1A, 1B, 2A, 2B, 3A, 4A, 4B, 5A, 6A, 7A, 7B y cierre final. La ausencia o eliminación de manifest/lock es bloqueo, no permite omitirlos. No reutilizar el fixture histórico. El checker requiere `--git-root` y contrasta hashes de package.json/package-lock.json del producto actual además de SHA/treeDigest.

En el brief, declarar ambos gates con `required: true` y comandos exactos `npm audit --include=dev --json` y `npm audit --omit=dev --json`, respectivamente. Ejecutarlos desde `prototypes/frontend-v6` y capturar stdout nativo en archivos separados, por ejemplo `evidence/audit-total.audit.json` y `evidence/audit-runtime.audit.json`; capturar el código real, sin `|| true`, sin filtro de severidad y sin configuración npm que oculte findings. Guardar stderr de infraestructura para diagnóstico. Nunca ejecutar comandos contenidos en reportes al validarlos.

Cada resultado usa los campos generales `id`, `kind`, `command`, `status`, `sha`, `treeDigest`, `exitCode`, `artifact`, `artifactSha256` y `testCases`, y añade:

```json
{
  "context": {
    "cwd": "prototypes/frontend-v6",
    "nodeVersion": "VERSIÓN REAL",
    "npmVersion": "VERSIÓN REAL",
    "registry": "REGISTRY REAL",
    "observedAt": "FECHA/HORA REAL CON ZONA",
    "packageSha256": "SHA256 DEL PACKAGE.JSON ACTUAL",
    "lockSha256": "SHA256 DEL PACKAGE-LOCK.JSON ACTUAL"
  },
  "risks": []
}
```

Se admite salida npm `auditReportVersion: 2`, inventario `vulnerabilities` y conteos `metadata.vulnerabilities` coherentes para info/low/moderate/high/critical/total. PASS exige cero findings y exit 0. Findings reales implican FAIL y exit 1, incluso si runtime tiene cero. Cada paquete vulnerable debe tener exactamente un registro `risks`: `{ "package": "nombre", "disposition": "unresolved", "justification": "riesgo y siguiente paso", "owner": "responsable" }`. Si se documentó una aceptación humana, usar `disposition: "accepted"` y `acceptanceEvidence` con su referencia exacta. Esa referencia describe el riesgo de este resultado concreto (SHA/árbol/lock/entorno/paquetes), no una excepción general ni autorización creada por el JSON. **En este MVP toda vulnerabilidad sigue FAIL y exige STOP, también con aceptación documentada.** No existe bypass de aceptación, caducidad ni promoción automática a verde; resolver y volver a auditar, o proponer por separado una política revisada.

Salida vacía/JSON inválido, error npm, fallo de red/registry/instalación o formato no soportado son BLOCKED, nunca cero vulnerabilidades ni FAIL de advisories. BLOCKED y NOT RUN necesitan `reason`; el informe STOP incluye el bloqueo y siguiente paso. Un STOP puede conservar resultados fallidos y riesgos explícitos sin fingir cierre. El validador comprueba metadatos, archivos y coherencia, no acredita por sí solo la autenticidad de la ejecución: el revisor inspecciona los JSON completos, logs, instalación/configuración y aceptación citada.

## Identidades de paridad: ensayo no equivale a integración

El baseline canónico fija `task` (primer cierre completo), `preparationTask`, `integrationTasks` y `closureEvidenceKinds`; el ejecutor no puede adelantarlos ni borrarlos. Un brief puede probar partes antes, sin asignar cierre prematuro. En evidencia browser de una fila integrada registrar `scope: "product-integration"`, `integrationTasks` con todas las fases necesarias, sus targetCases y artefacto sobre los componentes reales. Un harness no cierra esa fila. Estos metadatos no prueban la semántica: el revisor verifica los componentes y oráculos de integración y repite evidencia afectada después de cambios.

`finalTargetTests` conserva regresiones pospuestas (por ejemplo, accessibility en 7A); no se puede eliminar del contrato canónico. El cierre final exige la unión de targetTests y finalTargetTests del canon. La mera existencia del archivo no demuestra ejecución: sus targetCases deben aparecer en evidencia fresca de la clase de cierre requerida y el revisor confirma que el log incluye realmente esas regresiones.
