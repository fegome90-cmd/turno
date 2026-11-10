# Auditoría con el router de diseño (árbol v0.4)

Entrada de la fase 0. Auditoría de solo lectura del prototipo v5 y del plan de migración, hecha el 08/11/2026 con el plugin **Design Skills Router 0.1.0** del dueño (árbol de decisiones v0.4, 82 referencias).

- [Informe](AUDIT_REPORT.md): qué se respondió, qué quedó pendiente y qué no se revisó.
- [Decisiones para el dueño](PENDING_OWNER.md) y [revisión del inventario](INVENTORY_REVIEW.md).
- `ledger.json`: expediente del router (revisión final), `scope-inventory.json`: disposición confirmada de las 82 skills.

Límites:

- **Aprobaciones.** Unas pocas respuestas tienen aprobación directa del dueño. La mayoría están marcadas como **delegadas por el dueño, no revisadas una por una**, según su instrucción del 08/11/2026. El helper no autentica identidades.
- **Rutas.** Las rutas de evidencia del expediente apuntan a la carpeta temporal donde se hizo la auditoría; para `resume` hay que reubicarlas.
- **Fuentes.** Las copias de las skills consultadas no se versionan aquí; se citan por commit fijado (my-skills `5211aae`, emilkowalski/skills `5206a95`, jakubkrehel/skills `157da62`).
- **Alcance.** Todo es verificación estática salvo la evidencia de navegador ya registrada en G0-RECORD. No se revisaron dirección de arte, tipografía, color, tokens (fase de identidad posterior, D8), layout, escritura ni la revisión de conjunto.
