# Migración propuesta de Turno a React y Base UI

Estado al 08/11/2026: **documentación y preparación, sin implementación de producto v6**. Publicar este paquete en el PR #2 no aprueba G0 ni las precisiones pendientes del plan. V5 conserva su código, pruebas y assets. No se integra backend, no se hace merge ni se despliega.

## Leer en este orden

1. [Paquete para iniciar fase 0](FASE_0.md): runbook, roles, tareas/tests/gates y borradores de ADR, aceptación, frontera host y registro G0 STOP. No ejecuta la fase ni crea v6.
2. [Preparación y bloqueos](PREFLIGHT.md): último recorrido completo v5 **210/212**, auditoría con **10 moderadas dev** y navegador **BLOCKED**.
3. [Plan auditado](PLAN.md): fases, interfaces, riesgos, criterios y decisiones que requieren aceptación. Amplía la [propuesta inicial](../../prototypes/frontend-v5/docs/MIGRACION_REACT.md), conservada como antecedente.
4. [Matriz de paridad](parity-map.json): **212 requisitos fuente de 16 archivos**, todos `planned`, con IDs estables y destinos propuestos bajo `prototypes/frontend-v6/`. No acredita 212 tests React ejecutados.
5. [Contratos de tareas y validación](agent-contracts/README.md): contexto mínimo, roles, ejemplos STOP y checker de estructura/integridad. No garantizan obediencia ni veracidad de evidencias.
6. [Lecciones incorporadas a la ejecución](EXECUTION_LESSONS.md) y [mapa operativo](migration-risks.json): controles adicionales obligatorios por fase, con oráculos y evidencia, sin alterar los 212 requisitos fuente.
7. [React al 08/11/2026](REACT_RESEARCH.md): versiones propuestas frente al fixture, novedades estables, avisos RSC de octubre, límites del Compiler/toolchain y controles de G0–G7. No instala ni actualiza producto.
8. [Casos reales de migración y riesgos derivados](CASOS_REALES.md): fuentes de Slack, Preply, Heap, HackerRank, Trello, GitHub y Base UI. No atribuyen incidentes ajenos al prototipo.

## Qué cambió documentalmente

- Se prepara el inicio operativo de fase 0, con decisiones pendientes y responsables por rol; no se declara G0 aprobado ni se repiten pruebas de producto.
- Se incorpora investigación React actual con fuentes oficiales y aplicación a gates existentes. Se distingue producto vanilla, fixture ensayado y recomendación pendiente; Compiler es opcional y el port Oxc experimental queda fuera de la base.
- Se incorpora el plan auditado y la preparación posterior, con sus fallos y límites, sin presentar la ejecución histórica verde como resultado final.
- Se mantienen separados pruebas DOM/estáticas, navegador, visual, tecnologías de asistencia/dispositivos y host.
- Se precisan tema de sesión, umbrales de navegación a 700 px y Tiempo a 1000 px, paridad de avisos y conservación de selección/undo/IME. Son propuestas para aceptar, no cambios de producto ya realizados.
- Se conserva la atribución de los recursos de terceros en las [licencias de v5](../../prototypes/frontend-v5/licenses/). Las licencias MIT allí incluidas corresponden a las fuentes citadas, no conceden una licencia general al código ni a la marca Turno.

## Validación de este paquete

Desde la raíz del repositorio, con Python 3.12 o superior:

```sh
python3 docs/migration-v6/scripts/check_docs.py
python3 -m unittest discover -s docs/migration-v6/agent-contracts/tests -v
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json --brief docs/migration-v6/agent-contracts/examples/brief-1A.json --report docs/migration-v6/agent-contracts/examples/report-1A-stop.json
```

El primer comando comprueba JSON, enlaces locales, coincidencia de 212 nombres fuente y ausencia de modificaciones al código/tests/assets v5 frente al manifiesto de referencia. Los otros validan el checker y el formato de un STOP. **No ejecutan Turno React, no certifican paridad ni cierran G0.** No se han añadido workflows ni estados de CI mediante estos documentos.

Antes de ejecutar producto: resolver o acordar el rebaseline, tratar el riesgo de dependencias, aceptar las precisiones pendientes y disponer de rama/entorno autorizados con una vía de navegador permitida.
