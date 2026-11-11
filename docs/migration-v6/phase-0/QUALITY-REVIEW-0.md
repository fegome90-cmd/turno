# Revisión de calidad · fase 0, tarea 0.4

Revisor: subagente Claude Sonnet, instancia distinta del revisor de especificación. Solo lectura, worktree desechable en `d6964d0`, 08/11/2026. Transcrito por el orquestador desde el informe del revisor (su archivo de trabajo quedó con un resumen).

**Veredicto: conforme con observaciones.** 0 BLOCK, 5 WARN, 4 SUGGEST.

## Hallazgos y disposición

| ID | Sev | Archivo | Hallazgo | Disposición |
|---|---|---|---|---|
| Q-01 | WARN | `FASE_0.md:3` | Seguía «no aprueba el plan ni las seis precisiones» | Corregido: D1–D9 aceptadas, firma global pendiente |
| Q-02 | WARN | `G0-RECORD.md` | Afirmaba «residuos corregidos» con Q-01 aún presente | Corregido al resolver Q-01 |
| Q-03 | WARN | `G0-RECORD.md` | «Revisiones de 0.4: pendientes» aunque la segunda pasada de especificación existía | Corregido: revisiones emitidas y enlazadas |
| Q-04 | WARN | `G0-RECORD.md` (B1) | Estado «D1–D6 aceptadas» | Corregido a D1–D9 |
| Q-05 | WARN | `scripts/check_docs.py` | Un archivo nuevo en v5 pasaba; los documentos exceptuados no fijan contenido | Archivo nuevo: ahora falla (comprobado con `src/zz-new.mjs`). Documentos exceptuados: límite aceptado y declarado |
| Q-06 | SUGGEST | `G0-RECORD.md:3` | «Falta solo la aceptación» chocaba con casillas sin marcar | Corregido |
| Q-07 | SUGGEST | `EXECUTION-0.md` | La reproducción requiere `node_modules` no versionado | Anotado como requisito |
| Q-08 | SUGGEST | `EXECUTION-0.md` | Recuentos válidos solo para `0712b4c` | Rotulado |
| Q-09 | SUGGEST | `G0-RECORD.md` | «102/102 blobs» no reproducible con el manifiesto de 83 | Marcado como histórico no reproducible |

## Comprobaciones del revisor

1. Suite completa, archivo por archivo: 212 pass, 0 fail; cifras por archivo iguales a EXECUTION-0.
2. `build_preview.py`: código 0, 1.086.162 bytes; SHA256 `29e80f24c70e342b18b2f3f4023a4cf55e7e2dbb782292a5d57be5314c713c37`, idéntica.
3. `check_portable.mjs`: PASS (solo Node/LinkeDOM), tras disponer de `node_modules`.
4. Validaciones documentales: `check_docs.py` PASS; 79 pruebas del checker OK; `contract_gate` con y sin brief/report OK.
5. Diff de fase 0 (`0712b4c..d6964d0`): 4 commits, 11 archivos, todos en `docs/migration-v6/`.
6. Delta de v5 (`0f534df..d6964d0`): 10 archivos; 7 pruebas en `approvedDeltas` y 3 documentos; ningún cambio en `src/`, assets ni scripts.
7. Casos negativos del checker: editar `src/motion.mjs`, una prueba no aprobada, una prueba aprobada o un `status` de la matriz falla. Añadir `src/new.mjs` y editar el README de v5 pasaban (Q-05).
8. Registros: los SHA citados existen; versiones de entorno coinciden; PASS/FAIL/BLOCKED/NOT RUN no se mezclan; navegador, dispositivos, lectores, Firefox, WebKit, paridad React y host figuran como no verificados; las aprobaciones delegadas del router están rotuladas.

## Qué faltaba antes de firmar (según el revisor)

1. Corregir Q-01 a Q-04 (hecho).
2. Repetir HEAD, delta, `check_docs.py`, suite y huella sobre el HEAD final (hecho, ver EXECUTION-0).
3. Marcar la casilla de revisiones con ambos informes enlazados (hecho).
4. Que el dueño revise el diff de `baseline-files.json`.
5. Firma global de plan y ADR.
6. Tras firmar, v6 sigue sin autorización: requiere un encargo nuevo.

No hay bloqueo sustantivo a la firma.
