# Revisión del inventario de 82 skills

Propuesta enviada al registro, **sin confirmar** (esperando tu revisión). Archivo: `scope-inventory.json`. Cada fila cita la skill leída en su commit fijado y, cuando existe, la evidencia de Turno que la sustenta. Las skills claramente ajenas (shell, macOS, agentes por línea de comandos, Swift, Expo, presentaciones) se juzgaron por su descripción y cabecera; las de diseño y movimiento se leyeron con más detalle.

## Conteo por disposición

| Disposición | Cantidad | Qué significa aquí |
|---|---|---|
| Aplicable | 17 | Pertenece a un dominio de Turno. Algunas ya se aplicaron (orquestador, movimiento, accesibilidad, catálogo de librerías); otras son dominios que esta pasada no revisó (color, tipografía, layout, escritura, tokens, revisión de conjunto) y quedan pendientes |
| No aplicable | 42 | Otra plataforma o herramienta, o crea desde cero algo que Turno ya tiene y el plan conserva |
| Diferida | 11 | Podría hacer falta en una fase posterior de la migración (movimiento final, QA de la v6, Sonner). No se descartan |
| Solo gobernanza | 12 | Contexto de proceso, no se ejecutan |
| **Total** | **82** | |

Mientras haya aplicables sin revisar y diferidas, el router no deja cerrar la cobertura. Eso es lo esperado: refleja trabajo real pendiente, no un fallo.

## Dudosas

1. **Dirección de arte (design-art-direction): No aplicable.** Se registró así porque la identidad existe y el plan prohíbe rediseñar. Pero la rama de Dirección de arte no se revisó en esta pasada. Opciones: dejarla no aplicable; marcarla aplicable y revisar esa rama; marcarla diferida. Recomiendo dejarla no aplicable, salvo que quieras documentar la dirección de arte existente.
2. **Paleta desde cero (color-theory-palette): No aplicable.** Crea colores nuevos y Turno conserva los suyos. Si quieres auditar la paleta, para eso ya está la otra skill de color (aplicable). Opciones: no aplicable o diferida. Recomiendo no aplicable.
3. **Elegir y emparejar fuentes (typography-selection-pairing): No aplicable.** Las fuentes ya están elegidas y licenciadas. Opciones: no aplicable, o aplicable para verificar que el emparejamiento actual es sólido. Recomiendo no aplicable.
4. **Gestos (gestures): Diferida.** v5 no tiene gestos. Si Base UI Drawer añade deslizar en v6 (el plan menciona el riesgo de un gesto accidental), habría que evaluarlo. Opciones: diferida o no aplicable. Recomiendo diferida hasta decidir si se acepta ese deslizamiento.
5. **Hallar oportunidades de animación (find-animation-opportunities): No aplicable.** La migración busca paridad. Pero, si se acepta añadir la escala al pulsar del plan, cambiaría. Opciones: no aplicable o diferida. Recomiendo no aplicable mientras el plan se corrija a paridad.
6. **Skills de proceso (autoridad y flujos, subagentes, verificación de skills, revisión estructurada, ciclo de planes, cierre de trabajo, resolución de PR): Solo gobernanza.** Podrían ser aplicables si decides auditar la arquitectura del código o las revisiones de la rama v6. Opciones: gobernanza o aplicable. Recomiendo gobernanza; la de autoridad y flujos (authority-flow-audit) es la más candidata a pasar a aplicable en la fase 2A.
7. **Diagnóstico de conectividad de código (code-path-cartographer): Diferida.** Útil antes de portar app.mjs, innecesaria para diseño. Opciones: diferida o no aplicable. Recomiendo diferida.
8. **Pruebas de peor caso y de estados (break, break-ui, state-machine, interface-review): Diferidas.** Dependen de que exista una v6 que someter. Opciones: diferidas, o aplicables a v5 ahora. Recomiendo diferidas.
