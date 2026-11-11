# Design Skills Router · guía acotada de 2B

Se leyó el paquete instalado `design-skills-router` 0.2.1: SKILL.md, PILOT.md, ASSISTANCE.md, CLI.md y las referencias pertinentes del inventario canónico v0.4. No se reconstruyó el árbol ni se creó un expediente de diseño nuevo.

El expediente real `docs/migration-v6/design-audit/ledger.json` es schema 0.1, modo audit, alcance anterior a fase 0. El runner actual 0.2 devolvió `STATE_SCHEMA_MISMATCH_USE_UPGRADE_STATE` al consultar status, código 2 (`router-historical-status.json`). Se conserva intacto, no se migra ni se convierten sus recibos históricos en autorización para 2B. No se afirma transición ni gate de diseño aprobado.

El encargo actual es portar el contrato de historial de una migración ya acotada, sin rediseñar identidad ni extender producto. El harness técnico tiene un artefacto separado; datos sintéticos y componentes reales de historial/OverlayProvider/Dialog, sin simular TaskEditor ni Agenda como producto integrado.

Referencias originales recuperadas por sus pins, con bytes y Git blob:

- state-machine, commit `157da62016338e8693dcff93d47154a9e36f2157`, blob `26f835284b16b4d08372867ec75b0212019659c9`. REFERENCE_ONLY. Se revisó el criterio de un componente, datos en el límite existente y pending controlado. No se invoca como trabajo de exploración visual ni se añade su parámetro de URL, que no pertenece al contrato sin router de esta fase.
- authority-flow-audit, commit `5211aae8843eca4966d2aee828513582a04a7c8f`, blob `6b1cc4a6ea5116430012c4a697988bb374866a36`. REFERENCE_ONLY para orientar la revisión de autoridad/lifecycle. Evidencia operativa: sólo history-controller llama replaceState/pushState/go; el hook sólo instala/desinstala su listener; guardNavigation devuelve una decisión del coordinador/estado; applyRoute conserva selección/borrador del consumidor. El harness, no el controlador, conserva dirty y resultados de guardado. Logs y tests no son autoridad sobre esos estados.

La inspección de fuentes no constituye invocación completa de 82 skills, aceptación humana, auditoría visual, lector de pantalla ni host. El revisor independiente contrasta código/races; QA de navegador contrasta historia y foco reales. La evaluación visual del producto permanece en su fase correspondiente.
