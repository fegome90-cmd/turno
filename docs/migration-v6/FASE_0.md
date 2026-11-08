# Fase 0: paquete de inicio y decisión G0

**Estado al 08/11/2026: documentación preparada; fase 0 de ejecución NOT RUN; G0 pendiente / STOP.** Este paquete permite encargar la fase 0 sin crear `prototypes/frontend-v6/`, instalar dependencias, modificar v5 ni conectar backend. Publicarlo en el PR #2 no aprueba el plan ni las seis precisiones.

## Objetivo y entradas fijadas

Convertir la propuesta en un contrato revisable: referencia reproducible, 212 comportamientos trazados, decisiones explícitas y evidencia con dueño. La fase 1A solo comienza después de resolver G0 y contar con autorización de implementación.

| Entrada | Referencia y uso |
|---|---|
| Rama documental | [PR #2](https://github.com/fegome90-cmd/turno/pull/2), `frontend/fix-fullscreen-reflow-v8` → `main`, borrador |
| Corte remoto inspeccionado para este paquete | [70167c2a3bfa2f2e4059c41fa6d0b84138eb38e6](https://github.com/fegome90-cmd/turno/commit/70167c2a3bfa2f2e4059c41fa6d0b84138eb38e6), árbol `d47528eaeef1f6158585fb795f2f78089aec5fa9`; 102 blobs contrastados, sin fuente v6 |
| Referencia de comportamiento | `0f534df9bd5b012b4ec21c202a055e1e913bcab5`, último código `7141568f9fc765a2a2555a689a4df76dc9bfa44f`; [manifiesto de 83 blobs](baseline-files.json) |
| Contrato propuesto | [PLAN.md](PLAN.md), especialmente secciones 2 y 5; [investigación React](REACT_RESEARCH.md), [preparación histórica](PREFLIGHT.md) |
| Inventario canónico | [parity-map.json](parity-map.json): 212 IDs de 16 archivos, todos `planned`, sin evidencia React; no crear otra copia canónica |
| Controles adicionales | [método](EXECUTION_LESSONS.md), [mapa](migration-risks.json); fase 0 posee `EXTRA-ROLLBACK-PHASE`, gate `baseline`, clase `nonvisual` |

El corte remoto anterior es una entrada histórica, no el HEAD futuro ni el SHA de publicación de este paquete. El ejecutor relee HEAD/base/estado del PR y compara el delta antes de trabajar. Si cambia producto, inventario o contrato, detiene los pasos dependientes y actualiza la referencia con revisión; no reescribe historia ni acepta el delta tácitamente.

## Archivos y responsabilidades

- [ADR-001](phase-0/ADR-001.md): diseño propuesto, alternativas descartadas y estado de decisión.
- [ACCEPTANCE](phase-0/ACCEPTANCE.md): seis precisiones con oráculo y responsable de aceptación.
- [HOST-BOUNDARY](phase-0/HOST-BOUNDARY.md): frontera de demo, host y backend, sin inventar un contrato externo.
- [G0-RECORD](phase-0/G0-RECORD.md): registro inicial STOP, evidencia histórica frente a nueva y campos de cierre.
- `parity-map.json`, `baseline-files.json` y `migration-risks.json` permanecen canónicos en esta carpeta, sin cambios de IDs, estados ni evidencia por preparar documentos.

Estos borradores viven en `docs/migration-v6/phase-0/`. Las rutas `docs/ADR-001.md`, `docs/ACCEPTANCE.md`, `docs/HOST-BOUNDARY.md` y `docs/parity-map.json` del plan son destinos relativos a la futura aplicación `prototypes/frontend-v6/`, no rutas a crear ahora en la raíz. Al autorizar producto se adoptarán decisiones aceptadas y una matriz de trabajo con referencia al canon, sin sobrescribirlo.

## Roles y decisiones

| Rol | Responsabilidad | Asignación al iniciar ejecución |
|---|---|---|
| Usuario / dueño de producto | Aceptar o rechazar precisiones, rebaseline o tradeoffs concretos y autorizar implementación | Usuario; no se delega una aceptación humana a un checker |
| Orquestador | Resolver brief, comprobar alcance/rama, asignar dueños, custodiar canon y evidencia, aplicar STOP | Se identifica en G0-RECORD antes de ejecutar |
| Ejecutor de fase 0 | Leer fuente, reproducir checks en copia aislada y redactar resultados sin cambiar expectativas | Un trabajador nuevo, con identidad registrada |
| Revisor de especificación | Contrastar 212 identidades, decisiones y límites con fuentes; emitir hallazgos | Trabajador independiente del autor |
| Revisor de calidad | Revisar evidencia, reproducibilidad, alcance y consistencia después de especificación | Independiente del autor; puede ser el mismo revisor en una segunda pasada identificada |

No hay personas ni revisores de ejecución asignados por este documento. Registrar identidad real, fecha y referencia al emitir cada informe. El orquestador no marca aceptado lo que el usuario aún no decidió.

## Método de trabajo y tareas

Se aplica el método Superpowers al alcance solicitado: diseño y decisiones antes de producto, tareas pequeñas con comprobación explícita, revisión de especificación antes de calidad y verificación nueva antes de declarar cierre. TDD RED → implementación mínima → GREEN corresponde a futuros cambios de comportamiento; **no fabricar RED funcional para una tarea documental**. Los fallos inesperados se investigan antes de proponer arreglos. No cambiar tests, sleeps o expectativas para obtener verde.

### 0.1 · Fijar referencia y alcance

**Dueño:** orquestador + ejecutor. **Produce:** sección de referencias y hashes de G0-RECORD. **Test/oráculo:** HEAD/base/árbol observados, delta enumerado y todos los blobs de producto/tests/assets coinciden con el manifiesto; inventario mantiene 212 identidades de 16 archivos.

- [ ] Releer entradas, permisos y estado remoto; resolver checkout Git real, rama de ejecución autorizada y archivos propios. Una copia sin `.git` sirve para lectura/checks documentales, no para inventar `git rev-parse HEAD`.
- [ ] Comparar manifiesto y ejecutar los cuatro comandos documentales del apartado siguiente; guardar comandos, versiones, códigos y salida completa.
- [ ] Registrar SHA fuente y huella del árbol candidato. El candidato sigue siendo documental mientras no exista v6.

**Gate de tarea:** integridad e inventario PASS o STOP con paths/delta precisos. Es parte de `baseline` no visual, no G0 aprobado.

### 0.2 · Reproducir baseline y preparar vuelta segura

**Dueño:** ejecutor; revisor contrasta el resultado. **Produce:** informe de suite completa y build, hash del HTML de referencia y procedimiento de reapertura en sandbox. **Test/oráculo:** suite completa y discrepancia histórica resuelta mediante diagnóstico sustentado o decisión explícita de rebaseline que conserve el historial. Un completo nuevo verde aislado tampoco demuestra estabilidad ni cierra por sí solo los dos fallos registrados. Nunca reemplazar el último completo fallido por dos tests focalizados.

- [ ] Materializar v5 en una copia aislada; registrar Node/npm/Python, lock y método de instalación permitido. No actualizar dependencias ni tocar fuente de la referencia para esta reproducción.
- [ ] Desde `prototypes/frontend-v5/` de esa copia, ejecutar cada comando por separado y conservar su código de salida, aunque falle la suite: `node --test --test-concurrency=1 tests/*.test.mjs`, `python3 scripts/build_preview.py`, `node scripts/check_portable.mjs`.
- [ ] Si la suite falla, preservar salida completa y contrastar los dos casos históricos de PREFLIGHT con hipótesis/ensayo controlado. Si corregir exige cambiar v5, detener y proponer un encargo separado; no arreglarla en esta fase documental.
- [ ] Tras build exitoso, registrar ruta real y SHA256 del HTML emitido. Conservar referencia y candidato separados. Documentar cómo reabrir la referencia y que recargar reinicia la sesión. La reapertura real de navegador del rollback final pertenece a G7A; no atribuirla al hash.

**Gate de tarea:** referencia reproducible o decisión de rebaseline documentada y aceptada. Hoy permanece FAIL histórico / nueva reproducción NOT RUN. Build/LinkeDOM no certifican offline, visual ni foco nativo.

### 0.3 · Resolver contrato y condiciones de ejecución

**Dueño:** ejecutor prepara; usuario decide; orquestador registra. **Produce:** ADR, ACCEPTANCE y HOST-BOUNDARY revisados, y disposición de riesgos. **Test/oráculo:** cada precisión tiene decisión, evidencia de aceptación y alcance; lo pendiente sigue marcado pendiente.

- [ ] Revisar las seis decisiones D1–D6 de ACCEPTANCE, sin reabrir stack, carpeta aislada o contrato sin persistencia ya fijados.
- [ ] Separar producto vanilla, fixture y propuesta. Las 10 moderadas dev del fixture siguen FAIL histórico; resolverlas antes de reutilizar tooling en el alcance afectado; registrar aceptación contextual conserva FAIL/STOP en los gates de producto. Cero runtime no aprueba la auditoría total ni demuestra seguridad de aplicación.
- [ ] Identificar una vía de navegador permitida y su alcance antes de 1A. El bloqueo histórico no se declara resuelto por tener Playwright instalado ni se elude por otra ruta.
- [ ] Documentar fronteras por lectura; si no se inspeccionó backend/host, dejar contrato real NOT RUN. Su disponibilidad no bloquea la demo aislada.

**Gate de tarea:** contrato sin decisiones abiertas que afecten 1A y condiciones verificables, o STOP del paso dependiente. Aceptar este paquete documental no acepta un riesgo ni cambia permisos de publicación, integración o despliegue.

### 0.4 · Revisar y decidir G0

**Dueño:** revisores y orquestador; usuario acepta plan/decisiones. **Produce:** dictámenes de especificación y calidad, G0-RECORD con fuentes y autorización de siguiente paso.

- [ ] Revisor de especificación contrasta plan/ADR/aceptación, 212 identidades y control EXTRA; registra hallazgos con archivo y criterio.
- [ ] Tras resolver bloqueantes, revisor de calidad comprueba diff, resultados, hashes y límites. Una edición posterior obliga a repetir checks/revisión afectados.
- [ ] Orquestador reúne el registro completo y pregunta solo las decisiones humanas aún no resueltas, con consecuencias concretas. Registra cita o enlace verificable de aceptación, nunca un ejemplo como permiso.
- [ ] Evaluar G0 contra la lista de G0-RECORD. Si falta evidencia, hay FAIL/BLOCKED requerido o no existe aceptación, mantener STOP; no comenzar 1A.

**Gate G0:** referencia resuelta, inventario íntegro, contrato aceptado y condiciones/autorización de ejecución explícitas. Los gates de tarea de este documento descomponen G0; no crean nuevas aprobaciones ni rebajan las existentes.

## Comandos disponibles ahora

Desde la raíz de una copia completa del repositorio, con Python 3.12 o superior:

```sh
python3 docs/migration-v6/scripts/check_docs.py
python3 -m unittest discover -s docs/migration-v6/agent-contracts/tests -v
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json
python3 docs/migration-v6/agent-contracts/contract_gate.py --baseline docs/migration-v6/parity-map.json --matrix docs/migration-v6/parity-map.json --brief docs/migration-v6/agent-contracts/examples/brief-1A.json --report docs/migration-v6/agent-contracts/examples/report-1A-stop.json
```

**Esperado:** código 0 en los cuatro comandos, sin errores documentales; la suite del checker pasa; inventario y STOP estructuralmente válidos. El último valida un ejemplo 1A STOP, no ejecuta la fase 0. Si falla un comando, registrar FAIL/BLOCKED y no sustituirlo por el resultado de otro.

`contract_gate.py` no aprueba G0. Un reporte `READY` de ejecución requiere RED funcional y evidencia de aceptación, incompatibles con simular que esta preparación implementó comportamiento. No introducir RED ficticio ni marcar requisitos `verified`; la revisión documental y este registro humano permanecen separados. Para encargos futuros usar los [contratos existentes](agent-contracts/README.md), con autorización y árbol reales.

## Frontera offline entre fases

G1A prueba únicamente el shell disponible: apertura/recarga, fuentes/iconos, tema de sesión y ausencia de dependencias externas. Edición/guardado y reinicio de datos completos se prueban en G7A cuando existen esos flujos. En ambos, `file://` frío sin red y HTTP con servidor del documento disponible son escenarios separados; ningún build estático reemplaza navegador real. Véase [EXTRA-OFFLINE-ARTIFACT](EXECUTION_LESSONS.md).

## Resultado de preparar este paquete

Se contrastaron los 102 blobs del corte remoto con la copia de lectura. Se añaden borradores y runbook, sin cambiar producto, IDs ni resultados históricos. No se repitieron suite/build/auditoría del producto ni se ejecutó navegador. El [registro inicial](phase-0/G0-RECORD.md) conserva los bloqueos reales y los pasos aún no ejecutados.

## Auditoría estructurada y aceptación de riesgo

Registrar o aceptar un riesgo del fixture puede resolver una decisión de preparación, pero no aprueba G0 ni convierte la auditoría de producto en PASS. El [contrato del checker](agent-contracts/prompts/00-contract.md) exige auditorías total/runtime frescas sobre manifest/lock/SHA/árbol del producto. En este MVP cualquier vulnerabilidad conserva FAIL/STOP, incluso con aceptación documentada; no hay excepción automática para iniciar/cerrar 1A, fases siguientes o cierre final. Resolver y auditar otra vez, o proponer por separado una política revisada. Infraestructura fallida es BLOCKED, nunca cero advisories. G0 sigue STOP.
