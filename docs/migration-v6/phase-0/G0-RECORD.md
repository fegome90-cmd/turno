# Registro inicial de G0

**Resultado actual: STOP. G0 pendiente / no aprobado. Fase 0 de ejecución NOT RUN.** Fecha del registro: 08/11/2026. Este es un registro de preparación documental, no un reporte READY del checker ni una aceptación humana.

## Referencias y participantes

- Fuente documental inspeccionada: `70167c2a3bfa2f2e4059c41fa6d0b84138eb38e6`, árbol `d47528eaeef1f6158585fb795f2f78089aec5fa9`; PR #2 borrador.
- Fuente de comportamiento: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`; último código `7141568f9fc765a2a2555a689a4df76dc9bfa44f`.
- Dueños de ejecución/revisión: por asignar antes de iniciar; reparto y obligaciones en [FASE_0](../FASE_0.md).
- Aceptación del plan/ADR/D1–D6: no registrada. Autorización para implementar v6: no registrada por este paquete.
- SHA/huella de candidato de producto, lock de producto y HTML v6: no existen. No sustituirlos por valores del fixture ni del commit documental.

## Evidencia disponible frente a trabajo no ejecutado

| Comprobación | Resultado y procedencia | Límite |
|---|---|---|
| Copia documental contra corte remoto | 102/102 blobs coincidentes en la preparación de este paquete | Integridad de lectura; no ejecución de producto ni prueba de Git local |
| Producto/tests/assets v5 | Referencia de 83 blobs; checker documental contrasta manifiesto | No se editan para preparar fase 0 |
| Validación documental de este paquete | PASS documental fresco: 5 JSON, 18 Markdown y 95 enlaces locales; checker 79/79; inventario y ejemplo STOP válidos | Cuatro comandos de FASE_0; no ejecutan producto ni aprueban G0 |
| Inventario | 212 IDs de 16 archivos, todos planned; canon intacto | Fuente inventariada, no paridad React |
| Último completo v5 histórico | FAIL: 210 PASS / 2 FAIL, [PREFLIGHT](../PREFLIGHT.md) | Reproducción nueva NOT RUN |
| Focalizados históricos | 2/2 PASS, PREFLIGHT | No sustituyen último completo ni demuestran causalidad |
| Build/check portable v5 históricos | PASS Node/LinkeDOM, PREFLIGHT | Build nuevo NOT RUN; no offline/visual real |
| Auditoría fixture histórica | FAIL total: 10 moderadas dev; 0 runtime | Nueva auditoría NOT RUN; no es lock de producto ni vulnerabilidad de aplicación demostrada |
| Navegador/visual/dispositivo/AT | BLOCKED histórico, sin nueva ejecución | Vía permitida por identificar; no eludir el bloqueo |
| React/paridad/host | NOT RUN | No existe v6 ni integración |
| Plan/precisiones/riesgo/rebaseline | Pendientes de las decisiones aplicables | Documentos publicados no equivalen a aceptación |

## Bloqueos y próximos responsables

| Bloqueo | Acción necesaria | Responsable | Estado |
|---|---|---|---|
| B0 · Referencia no reproducida | Repetir suite completa sin alterar tests y diagnosticar discrepancia; si corresponde, proponer rebaseline concreto | Ejecutor + revisor; usuario decide rebaseline | FAIL histórico; nueva ejecución NOT RUN |
| B1 · Contrato no aceptado | Revisar ADR y D1–D6, registrar decisión y evidencia exacta | Usuario; orquestador registra | Pendiente |
| B2 · Riesgo tooling | Resolver hallazgos si se reutiliza el conjunto; aceptación contextual no cambia FAIL/STOP. Repetir auditorías total/runtime al fijar lock de producto | Ejecutor/revisor proponen; usuario acepta tradeoff | FAIL histórico del fixture |
| B3 · Navegador sin vía demostrada | Identificar vía permitida para pruebas 1A y conservar pendientes nativos/manuales posteriores | Orquestador + ejecutor | BLOCKED histórico; nueva vía no verificada |
| B4 · Encargo de producto no resuelto | Resolver checkout Git/rama/entorno reales y autorización de implementación; publicación de producto requiere alcance propio | Orquestador + usuario cuando haga falta | NOT RUN |

Backend/host no son un bloqueo de la demo. Registrar su NOT RUN sin convertirlo en una condición para comenzar la demo aislada.

## Lista de decisión G0

Solo marcar cada punto después de reunir evidencia real en este registro o un informe enlazado:

- [ ] HEAD/base/rama/entorno y delta verificados al iniciar la ejecución, sin cambios ajenos ni v5 alterada.
- [ ] Baseline resuelto: suite completa, build y checker con comandos/códigos/artefactos y discrepancia histórica diagnosticada, o rebaseline concreto aceptado con historial conservado. Un verde nuevo aislado no basta.
- [ ] 212 identidades fuente intactas y mapeadas; EXTRA-ROLLBACK-PHASE incluido en baseline no visual.
- [ ] HTML de referencia identificado por ruta real y SHA256 tras build; retorno seguro documentado sin afirmar que una referencia fallida es estable.
- [ ] Plan, ADR y seis precisiones aceptados con fuente, responsable y fecha.
- [ ] Disposición explícita de riesgos/condiciones aplicables al tooling y vía de navegador permitida para 1A.
- [ ] Revisiones de especificación y calidad emitidas, hallazgos bloqueantes resueltos y checks afectados repetidos.
- [ ] Autorización de implementación y alcance del siguiente encargo resueltos; permisos de publicación/integración/despliegue separados.

## Campos para el informe de ejecución futuro

Cada observación registra: responsable, fecha UTC, cwd real, SHA fuente, huella del árbol, versiones, comando/acción exactos, código de salida, estado PASS/FAIL/BLOCKED/NOT RUN, log/artefacto y SHA256 cuando corresponda. Para bloqueos, acción/target/motivo y si fue denegada, pendiente o de resultado incierto. Para decisiones humanas, cita o enlace verificable y alcance aceptado.

Valores actuales: no hay log nuevo de baseline, hash de HTML de referencia nuevo, rebaseline aceptado, riesgo aceptado, revisión de fase 0 ejecutada ni aceptación G0. No rellenar estos campos con ejemplos. El checker puede validar un STOP con código 0: no es permiso para avanzar.

## Auditoría estructurada y aceptación de riesgo

Registrar o aceptar un riesgo del fixture puede resolver una decisión de preparación, pero no aprueba G0 ni convierte la auditoría de producto en PASS. El [contrato del checker](../agent-contracts/prompts/00-contract.md) exige auditorías total/runtime frescas sobre manifest/lock/SHA/árbol del producto. En este MVP cualquier vulnerabilidad conserva FAIL/STOP, incluso con aceptación documentada; no hay excepción automática para iniciar/cerrar 1A, fases siguientes o cierre final. Resolver y auditar otra vez, o proponer por separado una política revisada. Infraestructura fallida es BLOCKED, nunca cero advisories. G0 sigue STOP.
