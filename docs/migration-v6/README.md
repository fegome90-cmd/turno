# Migración propuesta de Turno a React y Base UI

Estado consolidado al 10/11/2026: **frontend v6 con 4A/4B integrado y correcciones posteriores en el candidato de código `ed374be`; regresión Chromium Mac 226/226 y dos auditorías BLOCKED. La decisión formal sigue STOP; no se declaran G4A ni G4B aprobados.** Consultar el [estado actual, evidencia y siguiente paso](STATUS-4B.md) antes de ejecutar una fase. La presencia de documentos no aprueba gates, merge ni despliegue. V5 conserva su referencia aprobada; no se integra backend.

## Leer en este orden

El índice siguiente conserva el itinerario histórico de preparación. Sus menciones a STOP, bloqueos y ausencia de v6 describen aquel corte, no el estado consolidado actual. El [estado actual 4B](STATUS-4B.md) separa implementación, evidencia y aprobación formal. El [estado 2B](STATUS-2B.md) y el [registro 3A](../../prototypes/frontend-v6/docs/EXECUTION-3A.md) son históricos.

1. [Paquete para iniciar fase 0](FASE_0.md): runbook, roles, tareas/tests/gates y borradores de ADR, aceptación, frontera host y registro G0 STOP. No ejecuta la fase ni crea v6.
2. [Preparación y bloqueos](PREFLIGHT.md): último recorrido completo v5 **210/212**, auditoría con **10 moderadas dev** y navegador **BLOCKED** en la preparación. Después: B0 corregido como delta aprobado de pruebas (3 corridas 212/212) y vía Chromium verificada; detalle en [G0-RECORD](phase-0/G0-RECORD.md).
3. [Plan auditado](PLAN.md): fases, interfaces, riesgos, criterios y decisiones que requieren aceptación. Amplía la [propuesta inicial](../../prototypes/frontend-v5/docs/MIGRACION_REACT.md), conservada como antecedente.
4. [Matriz de paridad](parity-map.json): **212 requisitos fuente de 16 archivos**, todos `planned`, con IDs estables y destinos propuestos bajo `prototypes/frontend-v6/`. No acredita 212 tests React ejecutados.
5. [Contratos de tareas y validación](agent-contracts/README.md): contexto mínimo, roles, ejemplos STOP y checker de estructura/integridad. No garantizan obediencia ni veracidad de evidencias.
6. [Lecciones incorporadas a la ejecución](EXECUTION_LESSONS.md) y [mapa operativo](migration-risks.json): controles adicionales obligatorios por fase, con oráculos y evidencia, sin alterar los 212 requisitos fuente.
7. [React al 08/11/2026](REACT_RESEARCH.md): versiones propuestas frente al fixture, novedades estables, avisos RSC de octubre, límites del Compiler/toolchain y controles de G0–G7. No instala ni actualiza producto.
8. [Glosario](GLOSARIO.md) y [auditoría con el router de diseño](design-audit/README.md): producto general, vocabulario y decisiones D7–D9.
9. [Casos reales de migración y riesgos derivados](CASOS_REALES.md): fuentes de Slack, Preply, Heap, HackerRank, Trello, GitHub y Base UI. No atribuyen incidentes ajenos al prototipo.

## Qué cambió documentalmente en la preparación histórica

- Se separan ensayo temprano y cierre integrado para las 212 identidades: Home/Tiempo/Agenda, historial, archivo, avisos y movimiento se cierran cuando están presentes sus componentes reales. NumberField se prueba en 1B y se repite integrado en 4A.
- Se añaden gates de auditoría total/runtime y tests de rechazo de cierres prematuros o evidencia de clase incorrecta; la aceptación de riesgo no promociona FAIL a PASS en este MVP.
- Se prepara el inicio operativo de fase 0, con decisiones pendientes y responsables por rol; no se declara G0 aprobado ni se repiten pruebas de producto.
- Se incorpora investigación React actual con fuentes oficiales y aplicación a gates existentes. Se distingue producto vanilla, fixture ensayado y recomendación pendiente; Compiler es opcional y el port Oxc experimental queda fuera de la base.
- Se incorpora el plan auditado y la preparación posterior, con sus fallos y límites, sin presentar la ejecución histórica verde como resultado final.
- Se mantienen separados pruebas DOM/estáticas, navegador, visual, tecnologías de asistencia/dispositivos y host.
- Se precisan tema de sesión, umbrales de navegación a 700 px y Tiempo a 1000 px, paridad de avisos y conservación de selección/undo/IME. Son propuestas para aceptar, no cambios de producto ya realizados.
- Se conserva la atribución de los recursos de terceros en las [licencias de v5](../../prototypes/frontend-v5/licenses/). Las licencias MIT allí incluidas corresponden a las fuentes citadas, no conceden una licencia general al código ni a la marca Turno.

## Sobre los SHA citados

Los SHA que aparecen en el texto (cortes inspeccionados, referencia `0f534df`, último código `7141568`) describen el momento de cada observación y quedan desactualizados con cada commit nuevo. La referencia canónica de v5 es [baseline-files.json](baseline-files.json): blobs de referencia más `approvedDeltas`, comprobados por `check_docs.py`. Un cambio en `approvedDeltas` requiere revisión humana de su diff: es la aprobación real. Antes de ejecutar, leer el HEAD real del PR.

## Validación de este paquete

Desde la raíz del repositorio, con Python 3.12 o superior:

```sh
python3 docs/migration-v6/scripts/check_docs.py
python3 -m unittest discover -s docs/migration-v6/agent-contracts/tests -v
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json --brief docs/migration-v6/agent-contracts/examples/brief-1A.json --report docs/migration-v6/agent-contracts/examples/report-1A-stop.json
```

El primer comando comprueba JSON, enlaces locales, coincidencia de 212 nombres fuente y ausencia de modificaciones al código/tests/assets v5 frente al manifiesto de referencia. Los otros validan el checker y el formato de un STOP. **No ejecutan Turno React, no certifican paridad ni cierran G0.** No se han añadido workflows ni estados de CI mediante estos documentos.

Antes de avanzar desde el candidato actual: revisar el [estado 4B](STATUS-4B.md) y resolver las auditorías pendientes y la aceptación formal sobre fuente/evidencia exactas. El siguiente alcance previsto es 5A, avisos persistentes de interfaz y D12. La preparación anterior no sustituye esos gates ni reabre por sí sola decisiones ya registradas.
