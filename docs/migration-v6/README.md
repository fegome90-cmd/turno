# Migración propuesta de Turno a React y Base UI

Estado al 08/11/2026: **documentación y preparación, sin implementación de producto v6**. Publicar este paquete en el PR #2 no aprueba G0 ni las precisiones pendientes del plan. V5 conserva su código, pruebas y assets. No se integra backend, no se hace merge ni se despliega.

## Leer en este orden

1. [Preparación y bloqueos](PREFLIGHT.md): último recorrido completo v5 **210/212**, auditoría con **10 moderadas dev** y navegador **BLOCKED**.
2. [Plan auditado](PLAN.md): fases, interfaces, riesgos, criterios y decisiones que requieren aceptación. Amplía la [propuesta inicial](../../prototypes/frontend-v5/docs/MIGRACION_REACT.md), conservada como antecedente.
3. [Matriz de paridad](parity-map.json): **212 requisitos fuente de 16 archivos**, todos `planned`, con IDs estables y destinos propuestos bajo `prototypes/frontend-v6/`. No acredita 212 tests React ejecutados.
4. [Contratos de tareas y validación](agent-contracts/README.md): contexto mínimo, roles, ejemplos STOP y checker de estructura/integridad. No garantizan obediencia ni veracidad de evidencias.

## Qué cambió documentalmente

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
