# Criterios y decisiones de aceptación para fase 0

**Estado: propuesta; D1–D6 pendientes; G0 STOP.** Este archivo prepara decisiones, no prueba producto ni expresa aprobación del usuario. Fuente: [PLAN, sección 2](../PLAN.md). Responsable de decidir: usuario / dueño de producto. El orquestador registra decisión y evidencia; los revisores verifican alcance y trazabilidad.

## Contrato que se conserva

V5 inmutable, nueva v6 aislada; React 19/TypeScript/Vite/Base UI; demo sintética en memoria, sin red de producto, autenticación ni persistencia; fechas `DD/MM/AAAA`, hora 24 h y zona `America/Santiago`. Navegación desde 700 px y Tiempo desde 1000 px con excepciones del plan. Paridad de saludo, edición, avisos, archivo y operaciones simuladas, sin rediseño por adoptar librerías.

Los 212 comportamientos de la [matriz canónica](../parity-map.json) siguen `planned`, no equivalen a 212 tests React ejecutados. Los seis controles EXTRA complementan el inventario sin cambiar sus identidades.

## Seis precisiones por decidir

| ID | Propuesta y consecuencia | Test/oráculo futuro y gate | Decisión actual |
|---|---|---|---|
| D1 · Tema | Proveedor propio solo de sesión. No usar next-themes con persistencia por defecto | G1A: tema claro/oscuro/sistema, sin parpadeo observado ni escritura a storage; recarga vuelve al contrato de sesión. G1B: tokens/foco en portales | Pendiente |
| D2 · Más opciones | Popover/disclosure no modal si contiene selector de tema, sin role menu impropio | G1B: Tab sale, Escape/click externo cierran y click conserva destino; foco nativo comprobado | Pendiente |
| D3 · Validación | Field/Form asocian y muestran errores; dominio/adaptador conservan validación | G2A/G4A: mismos límites/raw inválido y errores; sin corrección silenciosa ni guardado válido desde dato inválido | Pendiente |
| D4 · Avisos | Sonner condicionado a paridad, adaptador público si hace falta; brecha no resuelta detiene fase | G1B/G5A: pila, 30 avisos, retención de errores, anuncios, foco y modal; alternativa solo con decisión explícita | Pendiente |
| D5 · Evidencia de navegador | Chromium mínimo final; Firefox/WebKit y dispositivo/AT con resultados separados, sin eliminar escenarios | G7A/G7B: ejecución real por motor y reporte manual de teclado/táctil/lector/IME; BLOCKED si no se puede comprobar | Pendiente |
| D6 · Final y host | Entregable v6 autónomo; host/backend con encargo y evidencias separados | G7 verifica prototipo; host real NOT RUN hasta sus cinco capas de evidencia del plan. No conectar por efecto secundario | Pendiente |

No confundir «Chromium mínimo» con autorización para omitir otros checks finales requeridos por el plan. Los resultados se separan; un requisito bloqueado no se convierte en PASS.

## Riesgos y condiciones que no se aceptan implícitamente

- Baseline: último completo registrado 210 PASS y 2 FAIL; dos focalizados PASS no sustituyen suite completa y un completo verde aislado no demuestra estabilidad. Resolver discrepancia o acordar rebaseline concreto, preservando resultados originales.
- Tooling: auditoría histórica del fixture FAIL por 10 moderadas dev, 0 altas/críticas y 0 runtime. No se ha repetido auditoría ni demostrado vulnerabilidad de aplicación. Resolver antes del uso afectado; una aceptación contextual de riesgo/alcance no levanta FAIL/STOP de auditorías de producto; sin `audit fix --force` ni override de major como atajo.
- Navegador: vía histórica BLOCKED. Identificar una vía permitida y los escenarios que puede probar antes de 1A; instalación o descubrimiento de motores no acreditan ejecución.
- Aceptar decisiones no concede permiso para push/PR de producto, merge, despliegue, credenciales, cambios de seguridad o integración. La publicación documental existente no cubre esas acciones.

## Cómo registrar aceptación efectiva

Por cada D1–D6, registrar decisión explícita, referencia exacta del plan/ADR, fecha, quién decidió y cita o enlace verificable a su aceptación. Una aceptación conjunta puede cubrir las seis si el usuario conoce ese alcance; si cambia una propuesta, registrar el delta y volver a revisar solo lo afectado. Mantener riesgo/rebaseline como decisiones separadas y concretas.

Registro actual de aceptación: **ninguno**. La lista operativa y los responsables de bloqueo están en [G0-RECORD](G0-RECORD.md).

## Auditoría estructurada y aceptación de riesgo

Registrar o aceptar un riesgo del fixture puede resolver una decisión de preparación, pero no aprueba G0 ni convierte la auditoría de producto en PASS. El [contrato del checker](../agent-contracts/prompts/00-contract.md) exige auditorías total/runtime frescas sobre manifest/lock/SHA/árbol del producto. En este MVP cualquier vulnerabilidad conserva FAIL/STOP, incluso con aceptación documentada; no hay excepción automática para iniciar/cerrar 1A, fases siguientes o cierre final. Resolver y auditar otra vez, o proponer por separado una política revisada. Infraestructura fallida es BLOCKED, nunca cero advisories. G0 sigue STOP.
