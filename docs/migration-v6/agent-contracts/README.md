# Contratos verificables para tareas de migración

Preparación de encargos, sin ejecución de Turno React ni aprobación de G0. Son plantillas del proyecto y un checker local, no permisos de publicación ni un sistema de aislamiento.

## Uso

1. Leer el [contrato común](prompts/00-contract.md) y elegir [implementador](prompts/10-implementer.md), [revisor](prompts/20-reviewer.md) u [orquestador](prompts/30-orchestrator.md).
2. Entregar brief resuelto y texto íntegro de la tarea con interfaces, rutas, criterios y autorización real. El [brief 1A](examples/brief-1A.json) está en modo `prepare`, sin autorización de producto. El [reporte de ejemplo](examples/report-1A-stop.json) declara STOP y pruebas NOT RUN.
3. Conservar los 212 IDs canónicos de la [matriz](../parity-map.json), incluso al trabajar un subconjunto. La cifra representa comportamientos fuente, no una exigencia de 212 tests React idénticos.
4. Registrar SHA, huella del árbol, cwd, fecha, versiones, casos ejecutados y artefactos. Una edición posterior exige repetir la evidencia afectada. Separar implementación, revisión de especificación y revisión de calidad.

La [investigación React vigente](../REACT_RESEARCH.md) agrega criterios técnicos a los gates existentes: al preparar un encargo autorizado, trasladar los aplicables al brief, comandos/casos y revisión. No crea nuevos IDs fuente/EXTRA ni modifica el checker; sus 44 tests no comprueban automáticamente versiones, advisories, transformación Compiler o ejecución offline.

## Comprobar las plantillas

Desde la raíz del repositorio:

```sh
python3 -m unittest discover -s docs/migration-v6/agent-contracts/tests -v
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json --brief docs/migration-v6/agent-contracts/examples/brief-1A.json --report docs/migration-v6/agent-contracts/examples/report-1A-stop.json
```

Los 44 tests incluyen omisiones, IDs duplicados, gates incompletos, evidencia obsoleta, cambios fuera de alcance y cierre final sin gates requeridos. La comprobación de inventario no certifica paridad. El ejemplo STOP puede devolver código 0 porque describe correctamente un bloqueo; **no significa permiso para continuar**.

Al evaluar una ejecución futura, añadir `--root` con la raíz real de tests y artefactos y `--git-root` con el checkout observado. Baseline canónico y checker deben quedar fuera del alcance editable del implementador. El CLI carga el mapa canónico adyacente migration-risks.json y exige los EXTRA aplicables a la fase, y todos al cierre final, en su gate/clase de evidencia. Los tests incluyen omisión de EXTRA, navegador acreditado con unit y cierre final sin riesgos. El validador no ejecuta comandos de reportes ni modifica el repositorio. Códigos: 0 estructura válida, 1 contrato incumplido, 2 entrada/entorno bloqueado.

## Límites

- Verifica metadatos y bytes/hashes, no honestidad del log, semántica del test, competencia del revisor ni autorización humana. Un campo `executionAuthorized` no crea permiso.
- La huella Git incluye rastreados/no ignorados y destinos de symlinks. No audita efectos externos ni archivos ignorados. No sustituye aislamiento de entorno, lock ni instalación limpia.
- Las listas de casos deben provenir de resultados reales. RED por módulo ausente es setup fallido, no prueba de comportamiento.
- Un ensayo textual anterior de seis escenarios devolvió seis STOP correctos **sin estas plantillas**. No reprodujo el incumplimiento ni demuestra mejora causal del texto.
- El cierre final exige gates no visuales, Chromium/Firefox/WebKit, portabilidad real, visual y pruebas manuales de táctil, lector de pantalla e IME. Un recolector con código 0 no acredita observación humana. Host/backend se declaran aparte.
- G0 y los bloqueos de la [preparación](../PREFLIGHT.md) siguen pendientes. Estas plantillas no autorizan tocar v5, backend ni otros trabajos, hacer push, merge o desplegar producto.
