# Registro inicial de G0

**Resultado actual: STOP, listo para firma. Falta solo la aceptación global del plan/ADR por el dueño; no se crea v6.**

Actualización 08/11/2026: la auditoría con el router de diseño añadió D7–D9 ([ACCEPTANCE](ACCEPTANCE.md)): producto general con «Lista» como término neutro, fase de identidad visual después de la migración y movimiento idéntico a v5. La firma pendiente cubre también estas decisiones. Fecha del registro: 08/11/2026. Este es un registro de preparación documental, no un reporte READY del checker ni una aceptación humana.

## Referencias y participantes

- Fuente documental inspeccionada: `70167c2a3bfa2f2e4059c41fa6d0b84138eb38e6`, árbol `d47528eaeef1f6158585fb795f2f78089aec5fa9`; PR #2 borrador.
- Fuente de comportamiento: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`; último código `7141568f9fc765a2a2555a689a4df76dc9bfa44f`.
- Inicio de la fase 0: ordenado por el dueño el 08/11/2026 («Fase 0 ya»). Alcance: solo documentos, en la rama `frontend/fix-fullscreen-reflow-v8` (PR #2); no se crea v6.
- Roles de ejecución (sesión de Claude Code `session_018Vz8fXicQ8eriij1KjAcZi`):
  - Orquestador: Claude (sesión principal). Asigna, custodia el canon y la evidencia, aplica STOP y pregunta al dueño solo decisiones humanas.
  - Ejecutor de 0.1–0.3: subagente Claude Haiku, sin autoría del plan.
  - Revisor de especificación: subagente Claude Sonnet, independiente del ejecutor.
  - Revisor de calidad: otra instancia de subagente Claude Sonnet, distinta de la anterior, después de la revisión de especificación.
  - Dueño de producto: el usuario; firma plan, ADR y D1–D9.
- Entrada adicional: [auditoría con el router de diseño](../design-audit/README.md).
- D1–D9: aceptadas (decisión del dueño en esta sesión, 08/11/2026 (preguntas de G0 respondidas en la conversación de Claude Code)); detalle en [ACCEPTANCE](ACCEPTANCE.md). Plan/ADR: pendientes de firma. Autorización: cerrar G0 y parar; implementar v6 **no** autorizado.
- SHA/huella de candidato de producto, lock de producto y HTML v6: no existen. No sustituirlos por valores del fixture ni del commit documental.

## Evidencia disponible frente a trabajo no ejecutado

| Comprobación | Resultado y procedencia | Límite |
|---|---|---|
| Copia documental contra corte remoto | 102/102 blobs coincidentes en la preparación de este paquete | Integridad de lectura; no ejecución de producto ni prueba de Git local |
| Producto/tests/assets v5 | Referencia de 83 blobs; checker documental contrasta manifiesto | No se editan para preparar fase 0 |
| Validación documental de este paquete | PASS documental fresco en la preparación (histórico; recuentos actuales en EXECUTION-0): 5 JSON, 18 Markdown y 101 enlaces locales; checker 79/79; inventario y ejemplo STOP válidos | Cuatro comandos de FASE_0; no ejecutan producto ni aprueban G0 |
| Inventario | 212 IDs de 16 archivos, todos planned; canon intacto | Fuente inventariada, no paridad React |
| Último completo v5 histórico | FAIL: 210 PASS / 2 FAIL, [PREFLIGHT](../PREFLIGHT.md) | Reproducción nueva NOT RUN |
| Focalizados históricos | 2/2 PASS, PREFLIGHT | No sustituyen último completo ni demuestran causalidad |
| Corrección de B0 (`536c511`, ajustes `077b986` y `ee34b76`) | Mecanismo identificado. Re-auditoría independiente sobre `340424b`: suite completa 212/212 en 3 corridas consecutivas (secuencial, por archivo). Cifras solo del autor, no repetidas por la re-auditoría: anteriores 0/3 y corregidas 3/3 con adaptador a 300 ms; 6/6 con CPU saturada. Detalle en [PREFLIGHT](../PREFLIGHT.md#diagnóstico-y-corrección-posterior-08112026). Riesgo residual (75/212 a 300 ms; 66/212 al repetir sobre `81544e1`) corregido en `ee34b76`: esperas acotadas a que la app vuelva a habilitar sus controles tras cada viaje al adaptador, sin cambiar nombres, aserciones ni expectativas; suite completa 212/212 a 220 ms en 3 corridas consecutivas, a 300 ms y a 600 ms (cifras del autor, sin re-auditoría independiente) | Solo pruebas; build, auditorías y navegador no repetidos; el diff de `baseline-files.json` sigue pendiente de revisión humana |
| Build/check portable v5 históricos | PASS Node/LinkeDOM, PREFLIGHT | Build nuevo NOT RUN; no offline/visual real |
| Auditoría fixture histórica | FAIL total: 10 moderadas dev; 0 runtime | Nueva auditoría NOT RUN; no es lock de producto ni vulnerabilidad de aplicación demostrada |
| Navegador (Chromium) | PASS de la re-auditoría del 08/11/2026 sobre `340424b`, Chromium 153.0.8010.12 vía Playwright de este entorno; detalle en B3 abajo | Solo Chromium; no es G7A/G7B ni producto v6 |
| Ejecución de fase 0 (0.1–0.3) | 0.1 PASS, 0.2 PASS (212/212, HTML `29e80f24…` reproducido), 0.3 con 4 inconsistencias documentales, corregidas en `08ec7e4`; ver [EXECUTION-0](EXECUTION-0.md) | Revisión de especificación de 0.4: ver fila siguiente |
| Visual/dispositivo/AT, Firefox, WebKit | NOT RUN | Sin dispositivos reales, lectores de pantalla ni otros motores |
| React/paridad/host | NOT RUN | No existe v6 ni integración |
| Plan/precisiones/riesgo/rebaseline | Pendientes de las decisiones aplicables | Documentos publicados no equivalen a aceptación |

## Bloqueos y próximos responsables

| Bloqueo | Acción necesaria | Responsable | Estado |
|---|---|---|---|
| B0 · Referencia no reproducida | Repetir suite completa sin alterar tests y diagnosticar discrepancia; si corresponde, proponer rebaseline concreto | Ejecutor + revisor; usuario decide rebaseline | Resuelto: rebaseline aceptado por el dueño el 08/11/2026, dicho en la conversación de Claude Code (pregunta «Rebaseline», respuesta «Aceptado (Recommended)»), sin enlace; aceptó sin revisar línea a línea el diff de `baseline-files.json`, que sigue disponible para su revisión humana (referencia `0f534df` + `approvedDeltas`). En `1d03821`: 212/212 a 220 ms y a 300 ms, 566 aserciones y nombres de prueba idénticos a `81544e1` |
| B1 · Contrato no aceptado | Revisar ADR y D1–D6, registrar decisión y evidencia exacta | Usuario; orquestador registra | D1–D6 aceptadas el 08/11/2026; plan/ADR pendientes de firma |
| B2 · Riesgo tooling | Resolver hallazgos si se reutiliza el conjunto; aceptación contextual no cambia FAIL/STOP. Repetir auditorías total/runtime al fijar lock de producto | Ejecutor/revisor proponen; usuario acepta | Disposición del dueño (08/11/2026, conversación de Claude Code, respuesta «Esperar parche upstream (Recommended)», sin enlace): esperar el parche upstream, sin overrides forzados; repetir `npm audit` total y runtime al crear el lock de v6 en 1A. Hasta entonces la auditoría del fixture sigue FAIL |
| B3 · Navegador sin vía demostrada | Identificar vía permitida para pruebas 1A y conservar pendientes nativos/manuales posteriores | Orquestador + ejecutor | Vía Chromium/Playwright de este entorno verificada, solo Chromium. Firefox, WebKit, dispositivos y AT: NOT RUN |
| B4 · Encargo de producto no resuelto | Resolver checkout Git/rama/entorno reales y autorización de implementación; publicación de producto requiere alcance propio | Orquestador + usuario cuando haga falta | Alcance actual: cerrar G0 y parar. Crear `frontend-v6` requiere una nueva autorización |

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

- [ ] (Verificado en 0.1 sobre `0712b4c`; se repite sobre el HEAD que firme el dueño) HEAD/base/rama/entorno y delta verificados al iniciar la ejecución, sin cambios ajenos ni v5 alterada.
- [x] Baseline resuelto: suite completa, build y checker con comandos/códigos/artefactos y discrepancia histórica diagnosticada, o rebaseline concreto aceptado con historial conservado. Un verde nuevo aislado no basta.
- [x] 212 identidades fuente intactas y mapeadas; EXTRA-ROLLBACK-PHASE incluido en baseline no visual.
- [x] HTML de referencia identificado por ruta real y SHA256 tras build; retorno seguro documentado sin afirmar que una referencia fallida es estable.
- [ ] Plan, ADR y precisiones D1–D9 aceptados con fuente, responsable y fecha (D1–D9 sí; plan/ADR pendientes de firma).
- [x] Disposición explícita de riesgos/condiciones aplicables al tooling y vía de navegador permitida para 1A.
- [ ] Revisiones de especificación y calidad emitidas, hallazgos bloqueantes resueltos y checks afectados repetidos.
- [x] (Resuelto como NO autorizada: alcance = cerrar G0 y parar; v6 requiere autorización nueva) Autorización de implementación y alcance del siguiente encargo resueltos; permisos de publicación/integración/despliegue separados.

Evidencia de las casillas marcadas (08/11/2026, HEAD `1d038215a603e935368ccde8f258a77242ba5fd3`):

- Baseline: rebaseline aceptado (B0). Suite completa 212/212 a 220 ms y a 300 ms, un archivo por vez; `check_docs.py`, 79 tests del checker y `contract_gate` OK.
- Identidades: `check_docs.py` confirma 212 IDs de 16 archivos; nombres de prueba idénticos tras los deltas.
- HTML de referencia: `prototypes/frontend-v5/preview.html` (generado, no versionado), 1.086.162 bytes, SHA256 `29e80f24c70e342b18b2f3f4023a4cf55e7e2dbb782292a5d57be5314c713c37`; `check_portable.mjs` PASS. Retorno: reconstruir desde ese commit con `python3 scripts/build_preview.py`; recargar reinicia la sesión.
- Riesgos y navegador: B2 con disposición del dueño; vía Chromium verificada (B3).
- Revisiones de 0.4: pendientes. La revisión de especificación sobre `08ec7e4` dio «no conforme» (2 bloqueantes, corregidos en el commit siguiente); falta repetirla sobre lo corregido y la revisión de calidad. Las revisiones anteriores (`340424b`…`1d03821`) son del paquete previo a D7–D9.
- Autorización: cerrar G0 y parar.

Sin marcar: la verificación de HEAD sobre el commit que se firme, las revisiones de 0.4 y la aceptación global del plan/ADR, que requiere la firma del dueño.

## Campos para el informe de ejecución futuro

Cada observación registra: responsable, fecha UTC, cwd real, SHA fuente, huella del árbol, versiones, comando/acción exactos, código de salida, estado PASS/FAIL/BLOCKED/NOT RUN, log/artefacto y SHA256 cuando corresponda. Para bloqueos, acción/target/motivo y si fue denegada, pendiente o de resultado incierto. Para decisiones humanas, cita o enlace verificable y alcance aceptado.

Valores actuales: baseline y HTML de referencia en [EXECUTION-0](EXECUTION-0.md); rebaseline y disposición de riesgo registrados abajo; revisiones de 0.4 y aceptación G0 pendientes. No rellenar estos campos con ejemplos. El checker puede validar un STOP con código 0: no es permiso para avanzar.

## Auditoría estructurada y aceptación de riesgo

Registrar o aceptar un riesgo del fixture puede resolver una decisión de preparación, pero no aprueba G0 ni convierte la auditoría de producto en PASS. El [contrato del checker](../agent-contracts/prompts/00-contract.md) exige auditorías total/runtime frescas sobre manifest/lock/SHA/árbol del producto. En este MVP cualquier vulnerabilidad conserva FAIL/STOP, incluso con aceptación documentada; no hay excepción automática para iniciar/cerrar 1A, fases siguientes o cierre final. Resolver y auditar otra vez, o proponer por separado una política revisada. Infraestructura fallida es BLOCKED, nunca cero advisories. G0 sigue STOP.
