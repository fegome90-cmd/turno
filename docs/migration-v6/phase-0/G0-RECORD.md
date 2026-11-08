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
| Corrección de B0 (`536c511`, ajuste `077b986`) | Mecanismo identificado. Re-auditoría independiente sobre `340424b`: suite completa 212/212 en 3 corridas consecutivas (secuencial, por archivo). Cifras solo del autor, no repetidas por la re-auditoría: anteriores 0/3 y corregidas 3/3 con adaptador a 300 ms; 6/6 con CPU saturada. Detalle en [PREFLIGHT](../PREFLIGHT.md#diagnóstico-y-corrección-posterior-08112026) | Solo pruebas; 75/212 siguen sensibles a un adaptador más lento |
| Build/check portable v5 históricos | PASS Node/LinkeDOM, PREFLIGHT | Build nuevo NOT RUN; no offline/visual real |
| Auditoría fixture histórica | FAIL total: 10 moderadas dev; 0 runtime | Nueva auditoría NOT RUN; no es lock de producto ni vulnerabilidad de aplicación demostrada |
| Navegador (Chromium) | PASS de la re-auditoría del 08/11/2026 sobre `340424b`, Chromium 153.0.8010.12 vía Playwright de este entorno; detalle en B3 abajo | Solo Chromium; no es G7A/G7B ni producto v6 |
| Visual/dispositivo/AT, Firefox, WebKit | NOT RUN | Sin dispositivos reales, lectores de pantalla ni otros motores |
| React/paridad/host | NOT RUN | No existe v6 ni integración |
| Plan/precisiones/riesgo/rebaseline | Pendientes de las decisiones aplicables | Documentos publicados no equivalen a aceptación |

## Bloqueos y próximos responsables

| Bloqueo | Acción necesaria | Responsable | Estado |
|---|---|---|---|
| B0 · Referencia no reproducida | Repetir suite completa sin alterar tests y diagnosticar discrepancia; si corresponde, proponer rebaseline concreto | Ejecutor + revisor; usuario decide rebaseline | Corregido en `536c511` (+ `077b986`) como delta aprobado de pruebas; 3 corridas completas consecutivas 212/212 en la re-auditoría. Riesgo abierto: 75/212 fallan con adaptador a 300 ms (cifra del autor) |
| B1 · Contrato no aceptado | Revisar ADR y D1–D6, registrar decisión y evidencia exacta | Usuario; orquestador registra | Pendiente |
| B2 · Riesgo tooling | Resolver hallazgos si se reutiliza el conjunto; aceptación contextual no cambia FAIL/STOP. Repetir auditorías total/runtime al fijar lock de producto | Ejecutor/revisor proponen; usuario acepta tradeoff | FAIL histórico del fixture |
| B3 · Navegador sin vía demostrada | Identificar vía permitida para pruebas 1A y conservar pendientes nativos/manuales posteriores | Orquestador + ejecutor | Vía Chromium/Playwright de este entorno verificada, solo Chromium. Firefox, WebKit, dispositivos y AT: NOT RUN |
| B4 · Encargo de producto no resuelto | Resolver checkout Git/rama/entorno reales y autorización de implementación; publicación de producto requiere alcance propio | Orquestador + usuario cuando haga falta | NOT RUN |

### B3 · Evidencia de navegador (re-auditoría del 08/11/2026)

SHA `340424b143e83cb4cf71828523120a9450cc79dd`. Chromium 153.0.8010.12 (`browser.version()`) con Playwright del entorno, servido con `python3 -m http.server 8765 --bind 127.0.0.1` desde `prototypes/frontend-v5`. Observado:

- Inicio y tarea a 1440x900 y 390x844 sin desbordamiento horizontal.
- Colores forzados + oscuro legibles: casillas nativas, iconos en color de sistema.
- Nombre de cama de 300 caracteres a 320 px sin desbordamiento horizontal (documento y panel).
- Atrás/Adelante con «Más opciones» abierto: cierra el menú y conserva Adelante. Con borrador sin guardar: diálogo; «Volver» conserva el borrador y «Descartar cambios» continúa; el historial se conserva.
- Movimiento reducido: solo animaciones de opacity/background-color (muestreo por frame).
- IME por CDP `Input.imeSetComposition`: Enter durante la composición (keyCode 229) no guarda; Enter posterior sí.
- Avisos y «Cerrar todos»; 0 errores de consola y 0 peticiones fallidas.
- `preview.html` por `file://`: renderiza con una sola petición y 0 errores.

NO verificado: dispositivos reales (táctil, teclado virtual, notch), lectores de pantalla, Firefox, WebKit, Safari/iOS, host/backend, paridad React y auditoría de dependencias. Esta evidencia no sustituye G7A/G7B ni ejecuta producto v6.

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
