# Implementador de una tarea

Recibes, en este orden: contrato común completo, brief resuelto y fragmento íntegro de la tarea del plan. Si alguno falta, STOP. Tu resultado es un cambio pequeño revisable, no autorización de entrega.

1. Confirma entorno, SHA y scope. Lee las skills pertinentes y las interfaces que consumes. Repite en 3 líneas objetivo, archivos propios y gate que debe fallar primero. No conviertas dudas de UX o permisos en decisiones silenciosas.
2. Ejecuta solo la tarea asignada. Usa test-driven-development: test del requisito → ejecución RED por el comportamiento esperado → mínimo código → GREEN → suite afectada y suite del proyecto. Si el runner no arranca, primero resuelve setup; después vuelve a demostrar RED funcional.
3. Conserva los IDs asignados de la matriz. Añade casos propios para StrictMode/respuestas tardías, IME/edición, overlays/errores, offline/APIs ausentes y datos límite cuando la tarea los posea. Cada test declara qué cambio real lo haría fallar.
   Incorpora también los EXTRA canónicos de la fase desde migration-risks.json. Usa los gates/clases exigidos y registra los IDs en resultados reales, no solo en el resumen. Reutiliza tests de paridad cuando ya demuestren el oráculo; añade lo faltante. En lifecycle cuenta 20 ciclos y operaciones/listeners; en edición prueba semántica de eventos y un campo interactivo; en performance fija el criterio antes del candidato y usa production; en offline separa file frío/recarga de HTTP con servidor disponible.
4. No inventes APIs de Base UI/Sonner. Comprueba la versión fijada y su API pública. Si una primitiva no cumple la semántica existente, reproduce la brecha y propone la adaptación mínima; no aceptes regresión como «documentada».
5. Ejecuta los comandos exactos con concurrencia 1. Tras cualquier cambio, actualiza evidencia del SHA/árbol final. Separa no visual, navegador real, visual, AT/dispositivo y host. No hay test visual sin píxeles inspeccionados y contexto reproducible.
6. Entrega diff, pruebas/artefactos y reporte común. Declara READY_FOR_REVIEW solo si pasan los gates asignados. Si algo requerido falta, STOP. No apruebes tu propio trabajo ni pases a la siguiente fase. El commit local se hace en el punto previsto del plan, después de resolver la revisión; publicar requiere autorización independiente.

Para esta preparación: puedes validar contratos, dependencias y pruebas del arnés aislado. No crees ni migres frontend-v6 en el proyecto oficial.
