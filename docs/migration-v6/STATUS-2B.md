# Turno 2B · Estado verificado y siguiente paso

Actualizado el 09/11/2026. **Código, pruebas de navegador y auditorías npm verificados; revisión de gates y cierre formal de 2B pendientes.** Este documento sustituye las menciones antiguas a «browser pendiente» para el candidato corregido, pero no altera ni borra los registros históricos.

## Fuente y resultado actual

- Candidato: `76943e5db6cf203e8f2738391f4318523c63ad7b`; árbol Git `f70a1a19b28d5dd2cedae789d07c1568ed4dc2ab`; base `fd777bfb1656dc55114e170e14474ba5ee70c481`.
- [Corrección y contrato](../../prototypes/frontend-v6/docs/REPLAY-RACE-FIX-2B.md): replay interrumpido, edición nueva tras aprobar guardar/descartar y batching de rutas React. `cancelPending()` revoca la decisión anterior antes de actualizar cualquier campo del borrador. Las integraciones 4A/4B deberán cumplir este contrato y repetir las regresiones.
- [Auditoría independiente del candidato](../../prototypes/frontend-v6/evidence/2B/independent-76943e5/INDEPENDENT-AUDIT-2B-FIX.md): no encontró defecto bloqueante residual en controlador/hook/harness; repitió tipos, lint, 111 unitarios, 81 componentes y ambos builds. Añadió 13 repros y 20.000 schedules sintéticos acotados. Esos casos se solapan con la suite versionada y no se suman como cobertura distinta ni como pruebas browser.
- [Verificación Mac del mismo candidato](../../prototypes/frontend-v6/evidence/2B/mac-76943e5/INFORME.md): **60/60 E2E PASS** reales en Chromium, 0 fallos, skipped, flaky o reintentos; workers 1. Incluye **44/44 de historial** (22 file:// y 22 HTTP) y **26/26 file://** (22 de historial y cuatro offline/tema). Ambos son subconjuntos de 60, no pruebas adicionales. Se ejecutó una suite completa, no tres corridas del candidato nuevo.
- En ese Mac también pasaron **111/111 unitarios, 81/81 componentes, tipos, lint y builds de producto/harness**. Portabilidad real file:// PASS: cero solicitudes externas y errores de consola/página, fuentes locales cargadas. Los 718 archivos de la fuente original coincidieron antes/después y con el árbol candidato.

Los resultados anteriores 105/57 y 40/40 ×3 corresponden a `72459f5`, no a `76943e5`. El bloqueo de Chromium por socket en la nube de implementación se conserva como resultado histórico; no invalida la ejecución Mac posterior ni se transforma en un PASS Linux. No se ejecutó la nube Codex del usuario.

## Gates y límites

| Gate | Estado y evidencia |
| --- | --- |
| Identidad de fuente | PASS sobre el snapshot original: commit/árbol anteriores, manifiestos Mac 718/718 y SHA256 del paquete verificados. Esta actualización posterior cambia documentación/evidencia, no código ni tests de producto. |
| Tipos/lint/unit/component/builds | PASS en auditoría independiente y Mac sobre el candidato. [Resumen Mac](../../prototypes/frontend-v6/evidence/2B/mac-76943e5/logs/SUMMARY.json). |
| Chromium y portabilidad | PASS en ese Mac y artefactos exactos, con adaptadores externos sólo de rutas/salida/navegador. [JSON E2E bruto](../../prototypes/frontend-v6/evidence/2B/mac-76943e5/logs/e2e-full.json) y [portabilidad](../../prototypes/frontend-v6/evidence/2B/mac-76943e5/logs/check-portable.json). |
| Auditoría total/runtime estructurada | **PASS en ejecución nueva 09/11/2026 13:20 UTC**, copia prístina `76943e5`, Node 24.22.1/npm 11.9.0, registry oficial y manifest/lock exactos. Ambos comandos requeridos salen 0 y producen JSON npm v2 nativo con 0 vulnerabilidades; stderr separado conserva el warning. [Contexto](../../prototypes/frontend-v6/evidence/2B/npm-audit-76943e5-20261109/CONTEXT.json), [total](../../prototypes/frontend-v6/evidence/2B/npm-audit-76943e5-20261109/audit-total.audit.json), [runtime](../../prototypes/frontend-v6/evidence/2B/npm-audit-76943e5-20261109/audit-runtime.audit.json) y [validación específica](../../prototypes/frontend-v6/evidence/2B/npm-audit-76943e5-20261109/AUDIT-VALIDATION.json). Fuente 718/718 intacta antes/después; no se reinstalaron dependencias ni se repitieron tests de producto en esta ejecución de auditoría. |
| Revisión formal y checker de cierre | Pendientes sobre la entrega efectiva: brief/reporte de 2B, gates requeridos, SHA/árbol, artefactos y revisiones de especificación/calidad. Ningún checker documental ni este informe concede APPROVE_PHASE. |
| Paridad integrada | Sin cierre nuevo: matriz de ejecución 30 verified no visuales de 2A y 182 planned; las diez HISTORY permanecen planned (01–05/07–10 en 4A y 06 en 4B). La matriz canónica de 212 identidades no cambia. |
| Otros motores, AT/dispositivos, visual y host | NOT RUN en este corte: Firefox/WebKit, IME real, lector de pantalla, revisión visual independiente, editor/Tiempo/Agenda/archivo integrados y host ChatGPT real. No se repitió check:parity ni npm audit en Mac. |

Los [archivos total](../../prototypes/frontend-v6/evidence/2B/replay-race-fix-20261109/final-audit-total.json) y [runtime](../../prototypes/frontend-v6/evidence/2B/replay-race-fix-20261109/final-audit-runtime.json) históricos empiezan con un warning npm antes del JSON. Su payload informaba 0 vulnerabilidades, pero el archivo completo no era JSON válido. Se conservan sin filtrar; el PASS actual procede de la ejecución nueva, no de limpiar esos archivos.

La auditoría independiente original **no ejecutó npm audit**: ejecutó `npm ls --depth=0` y los gates no browser indicados en su informe. La frase amplia del LEEME original que podía sugerir repetición independiente de auditorías npm no debe heredarse como evidencia. La validación nueva usa sólo `check_dependency_audits`: contrasta formato/contexto, hashes de manifest/lock y artefactos; no equivale al CLI completo ni a APPROVE_PHASE. `treeDigest` SHA256 de archivos y árbol Git son identificadores distintos.

## Estado remoto comprobado

Lectura del 09/11/2026, antes de guardar esta actualización documental:

- [PR #2](https://github.com/fegome90-cmd/turno/pull/2): abierto, draft, sin merge; head `ba6e1c90c4b3924886cc399f8ab22b5e29bde0e5`; base main `addd5a3189e0c9acc5e9b2a5b12e64030228a39e`; 35 commits y 117 archivos.
- [Rama 2B publicada](https://github.com/fegome90-cmd/turno/tree/work/phase2b-indexed-history): `fd777bf`, 17 commits por delante del head del PR #2 y ninguno por detrás. Incluirlos en #2 sigue pendiente de confirmación; esta entrega no lo hace.
- El commit `76943e5` no se encontró en GitHub y no se presenta como publicado. La rama ajena `claude/confident-galileo-rahzv6` se conserva intacta. No se modifica ninguna rama remota ni cuerpo del PR.
- En `fd777bf` se observaron dos estados Vercel success y ninguna ejecución PR de GitHub Actions. No pertenecen al candidato corregido ni certifican sus pruebas. En el head de #2 CodeRabbit informa success con cobertura incompleta; tampoco se atribuye al candidato. No se afirma CI `76943e5` PASS.

Esta actualización se entrega como paquete documental persistente, no como push de la corrección. No inicia publicación, merge ni despliegue.

## Qué sigue, en orden

1. **Consolidar evidencia formal de 2B.** Responsable: orquestador y revisión independiente. Incorporar la nueva captura válida de `npm audit --include=dev --json` y `npm audit --omit=dev --json` al brief/reporte final, junto con evidencia Mac y auditoría de código; contrastar hashes y contexto contra el snapshot efectivo. La captura ya está repetida y validada específicamente: no hace falta limpiar los originales ni atribuir la ejecución nueva al auditor original.
2. **Reconciliar y decidir G2B.** Revisar corrección, RED/GREEN, auditoría, evidencia Mac, contrato de cancelación y límites; completar brief/reporte y revisiones sobre los bytes efectivos. Corresponde registrar APPROVE_PHASE sólo si no quedan gates obligatorios FAIL/BLOCKED/NOT RUN. Hasta entonces no iniciar 3A por inferencia.
3. **Después de esa aprobación y de la orden de ejecución aplicable: 3A, layout y navegación responsivos.** Preparar un brief con `AppShell`, `Navigation`, `MoreOptions`, `DemoDialog`, `OverlayCoordinator`, función única `getPanelMode` y tests navigation/responsive/overlays. Usar el [alcance y G3 del plan](PLAN.md): umbrales 699/700 y 999/1000, anchos 320–1440, altura baja, fullscreen/resize, foco/teclado, Escape/Back y una sola instancia interactiva. Conservar caret/selección/undo/raw en el harness. Sus 16 identidades íntegramente disponibles y el ensayo parcial de DESIGN-AUDIT-02 no cierran editor/Agenda/archivo/avisos futuros con slots; DESIGN-AUDIT-02 conserva planned hasta probar también el checkbox del TaskEditor real en 4A.
4. **Separadamente, decidir publicación.** Confirmar la inclusión de los 17 commits en #2 y el destino del fix/documentación. Antes de actualizar cualquier ref, volver a leer remoto/base y comprobar ausencia de conflicto; no sobrescribir trabajo ajeno. Merge y despliegue siguen fuera del encargo actual.

## Fuentes conservadas e integridad

- `Turno_2B_76943e5_verificacion_Mac_60_E2E.zip`, Space ID `libfile_e0beff9a5cc08191b76262fe69744501`, SHA256 `c4f62db9ec83c5432d29051066674e8a0c44a23e3be44a0e8fcaef9809f22bb4`. Se conserva íntegra su evidencia en `prototypes/frontend-v6/evidence/2B/mac-76943e5/`, incluido manifiesto original y adaptadores.
- `Turno_2B_correccion_76943e5_bundle_pruebas_auditoria.zip`, Space ID `libfile_436d14f5d4248191a49c0dd62c3ad16a`, SHA256 `a3cd9d03f0c169f78e42da79512dea889ef663e4b0a53661ca8a7f76629df857`. Preserva snapshot, bundle incremental, patch, auditoría y pruebas originales.
- Producto `dist/preview.html`: SHA256 `ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343`; harness `dist-history/history-harness.html`: `fb6c2b83f65a4b64b0ec5aecdbae8f28daa9f953c37d6b9e5217f5832d6606a5`. Son artefactos distintos; el historial sigue fuera del producto Home mínimo.
- El bundle de fuente es incremental. La copia documental recupera el objeto commit y verifica el árbol completo; no reconstruye ni afirma disponer de toda su historia padre. La comprobación de antepasados para el cierre formal debe hacerse en una copia Git completa.
