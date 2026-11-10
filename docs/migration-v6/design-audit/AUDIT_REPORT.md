# Auditoría de diseño de Turno con el router de decisiones (pasada "lo que afecta a la migración", actualizada)

Modo: auditoría de solo lectura. Proyecto revisado: worktree de Turno en 776af91 (rama frontend/fix-fullscreen-reflow-v8). No se modificó nada del proyecto ni del router. Todas las verificaciones fueron estáticas (lectura de código y documentos); no se ejecutó la suite, ningún navegador ni lector de pantalla. Las skills de Emil Kowalski, Jakub Krehel y my-skills se leyeron en sus commits fijados como material de referencia; ninguna se invocó.

Registro final: revisión 118, 33 nodos aprobados (3 previos y 30 de esta pasada), 12 nodos en la frontera, cobertura de skills sin cerrar, `ready_for_human_handoff` falso.

## Resumen

- La migración no tiene un bloqueo de diseño nuevo. Medio, alcance de escritura, stack, identidad y movimiento salen coherentes con las decisiones ya aceptadas (D1 a D6).
- Hay cuatro puntos para el dueño (ver `PENDING_OWNER.md`): producto sin definir por escrito, contexto sin glosario ni validación, dos detalles de movimiento del plan que v5 no tiene, y las 82 skills sin disposición.
- La rama "Necesidad de componentes" no pudo revisarse porque depende de que el producto esté definido (punto 1).

## Nodos aprobados por delegación (respuesta rutinaria)

| Nodo (id) | Pregunta | Respuesta |
|---|---|---|
| Auditoría (E05) | Alcance de la auditoría | Un solo hijo, Fundaciones; el recorte de la pasada se aplica debajo |
| Fundaciones (E05__F00) | Dominios a revisar | Todas las ramas son obligatorias; esta pasada cubre las pedidas |
| Medio y permisos (E05__ENV00) | Ramas obligatorias | Entregable y alcance de escritura |
| Entregable (E05__S03) | Qué medio | Web en navegador |
| Medio web (E05__S04) | Comparar opciones web | No se abre comparación: el stack ya está fijado |
| Alcance de escritura (E05__ENV02) | Qué autoriza el encargo | Solo auditar |
| Auditar (E05__ENV02_2) | Resultado | Fuentes sin cambios |
| Stack (E05__S01) | ¿Está fijado y es compatible? | Sí: v5 vanilla; v6 con React 19, TypeScript, Vite y Base UI; versiones se fijan en la fase 1A |
| Stack conservado (E05__S02) | Resultado | Se conservan las restricciones (sin Tailwind, sin router de URL, sin Radix de ui-kit; auditoría de dependencias a repetir con el lock) |
| Diseño (E05__D00) | Ramas | Identidad completa; sistema visual revisado solo en cinco dominios |
| Identidad (E05__D01) | ¿Hay identidad autorizada? | Sí, la del PR #2 con las correcciones del PR #1, que el plan manda conservar |
| Cobertura de identidad (E05__D02) | ¿Cubre el encargo sin cambiarla? | Sí |
| Identidad conservada (E05__D03) | Resultado | Se conserva; sin documento de dirección de arte (límite declarado) |
| Sistema visual (E05__D10) | Dominios | Obligación completa; cinco revisados, siete no revisados |
| Movimiento (E05__M01) | ¿Aporta información o interacción? | Sí |
| Capacidades de movimiento (E05__M03) | Ramas | Las cuatro se revisan |
| Transiciones simples (E05__MOV01 y E05__MOV01_1) | ¿Se necesitan? | Sí, resueltas con WAAPI y CSS nativos |
| Resortes, gestos, layout (E05__MOV02 y E05__MOV02_2) | ¿Se requieren? | No; no se instala motion |
| Cifras (E05__MOV03 y E05__MOV03_2) | ¿Transición de cifras? | No; no se evalúa NumberFlow |
| Resistencia del movimiento (E05__MOV04 y E05__MOV04_3) | ¿Control, interrupción y alternativa reducida? | No verificado: solo pruebas simuladas y la observación de movimiento reducido en Chromium (ver hojas bloqueadas) |
| Contrato de cada componente (E05__RC01 y E05__RC01_2) | ¿Una o varias capacidades? | Varias (al menos nueve); se enumeran, pero no se evalúan candidatos por componente |
| Origen y adopción (E05__A10) | ¿Hay recurso adecuado? | Existe y requiere adaptación (dominio, estilos, activos y capacidades nativas de v5) |
| Accesibilidad (E05__AC01 y E05__AC01_3) | ¿Operables y comprensibles? | No se ha probado por criterio; base estática buena |
| Cobertura de skills (E05__GOV00) | ¿Todas las skills tienen disposición? | No: faltan asignaciones |

## Nodos que quedan para el dueño (no confirmados)

Texto completo en `PENDING_OWNER.md`.

> Resuelto después por decisiones del dueño (D7–D9, segunda ronda): producto definido, glosario congelado y plan corregido a paridad de movimiento.

1. Producto (E05__P01): propuesto "Parcialmente"; falta problema, personas y resultado por escrito. Hoja bloqueada a propósito en el árbol (P03).
2. Contexto (E05__C01): propuesto "Incompleto"; sin glosario ni validación del dominio. Hoja bloqueada a propósito (C03).
3. Cobertura de skills, hoja de bloqueo (E05__GOV00_2): propuesta redactada como BLOQUEADO, sin confirmar.
4. Detalle de movimiento del plan que v5 no tiene (pulsación .97 y hover 120 ms, PLAN líneas 346 y 350): hallazgo transversal; no cambia las respuestas ya aprobadas de Movimiento, pero el dueño debe decidir si se corrige el plan o se acepta como cambio.

## Hojas bloqueadas o pendientes (no se cierran como éxito)

- E05__MOV04_3: control e interrupción del movimiento sin verificar en navegador. Aprobada solo como constancia de pendiente.
- E05__AC01_3: accesibilidad con lector de pantalla, dispositivos y otros motores sin hacer (D5). Aprobada solo como constancia de pendiente.
- E05__RC01_2: evaluación por candidato (Base UI, Sonner, etc.) no hecha; fase 1B del plan.
- E05__GOV00_2: cobertura bloqueada.
- E05__P01 / E05__C01: pendientes del dueño; sus respuestas llevan a hojas bloqueadas por diseño del árbol.

## Nodos no revisados en esta pasada

- Necesidad de componentes (E05__R01): bloqueada por el router hasta que el producto (E05__P01) esté aprobado. No se propuso.
- Evaluación del recurso por candidato (E05__A12 y su hijo de candidato): requiere nombrar componente, requisito, fuente y versión; no se fabricó.
- Dirección de arte (E05__ART00), Tipografía (E05__T00), Color (E05__K01), Layout y contenido (E05__L00), Tokens y estados (E05__V01), Escritura (E05__WR01), Revisión de conjunto (E05__QA01): fuera de alcance, sin propuesta.
- Ramas hijas de P01 y C01 y de los demás nodos no activados.
- Inventario de las 82 skills: sin disposición ni confirmación.

## Observaciones útiles que no requieren decisión

- No existen PRODUCT.md, CONTEXT.md, STACK.md ni DESIGN.md; los equivalentes son el README del prototipo, DESIGN_V7, el PLAN y el ADR-001. La plantilla del orquestador dice que no hace falta crearlos.
- `docs/MIGRACION_REACT.md` (next-themes, Menu para Más opciones) está rotulado como antecedente histórico y lo superan D1 y D2. No se consideró conflicto vigente.
- Las licencias de las dependencias nuevas de runtime no están registradas en ningún documento; el plan las revisa en la fase 7A.
- En styles.css la variable de duración de pestañas vale 180 ms y no se usa; el JS usa 150 ms. Sin efecto.
- MOTION_V6 cita las skills de Emil en el commit c8a7962; esta auditoría usó 5206a95. Son revisiones distintas del mismo repositorio.
- Duraciones: avisos a 300 ms y feedback a 180 ms superan las bandas orientativas de las skills; el proyecto ya lo reconoce como pendiente de revisión visual.

## Estado final (`status`)

Revisión 118. Frontera: producto (E05__P01), contexto (E05__C01), dirección de arte (E05__ART00), tipografía (E05__T00), color (E05__K01), layout (E05__L00), tokens (E05__V01), necesidad de componentes (E05__R01), evaluación por candidato (E05__A12), escritura (E05__WR01), revisión de conjunto (E05__QA01) y bloqueo de cobertura (E05__GOV00_2). Nodos aprobados 33 de 45 activos. Inventario sin confirmar (82 pendientes). Sin permiso de ejecución, sin identidad humana autenticada. Listo para entrega humana: no.

## Archivos del expediente

Evidencias en `evidence/` (E05-scope, F00-project-docs, S03-medium, P01-product, S01-stack, D01-identity, M01-motion, M04-control-interruption, RC01-components, A10-resources, AC01-accessibility, GOV00-status-snapshot). Fuentes en `sources/` (orquestador, contratos, plantillas, design-art-direction, ui-motion-and-handoff, design-tokens-components, emil-design-eng, review-animations, pick-ui-library, better-accessibility, better-ui). Propuestas `proposal-*.json` y recibos `human-*.json`.

## Actualización: segunda ronda (worktree en 8d237fd, revisión 290)

Decisiones del dueño ya registradas: producto aprobado (gestor de tareas general para trabajo por turnos), vocabulario congelado en GLOSARIO.md sin validación de dominio ("Cama" pasa a "Lista" en v6), D7 a D9 en ACCEPTANCE, e inventario de 82 skills confirmado (hash 3ea1b6b3, 20 aplicables, 38 no aplicables, 12 de gobernanza, 12 diferidas).

### Aprobado por delegación en esta ronda

| Nodo (id) | Respuesta |
|---|---|
| Producto, resultado (E05__P02) | Documentado en el README del prototipo; no se creó PRODUCT.md |
| Cobertura de skills (E05__GOV00) | Se invalidó la respuesta anterior ("faltan asignaciones") porque el inventario ya está confirmado, y se respondió de nuevo: sí hay disposición explícita para las 82. Resultado (E05__GOV00_1): asignación cerrada, revisión NO cerrada |
| Necesidad de componentes (E05__R01) | Requisito de esta sesión: "Más opciones" como Popover no modal (D2); los demás componentes quedan en sesiones aparte |
| Comportamiento (E05__R02) | Capa interactiva no modal: candidato Base UI |
| Candidato Base UI 1.9.0 (E05__R03 y E05__R03__ADOPT) | Se abre su evaluación por seis ejes |
| Identidad del candidato (E05__R03__ADOPT_BIND y _1) | Sí: componente, requisito D2, fuente y versión 1.9.0 |
| Recurso existente de v5 (E05__A12 y E05__A12__ADOPT) | Se evalúa el recurso actual como candidato, con su propia identidad |
| Ejes del recurso v5: identidad, plataforma, licencia y seguridad (E05__A12__ADOPT_BIND, _PLATFORM, _LICENSE, _SECURITY y sus hojas _1) | Sí, con evidencia (corre en Chromium 153, 212/212 pruebas v5, código propio e icono ISC, sin red ni datos reales) |

Los ejes de accesibilidad y coste del recurso v5 (E05__A12__ADOPT_ACCESS y _COST) y los cinco ejes pendientes de Base UI también se aprobaron como respuesta "No verificado"; sus hojas quedan sin confirmar (ver abajo).

### Nuevos puntos para el dueño

Ver `PENDING_OWNER.md`: (1) solo se evaluó un componente de los doce; (2) la hoja de Contexto (E05__C03) no se pudo proponer porque el router la bloquea a propósito.

### Hojas bloqueadas o pendientes (no son éxito)

- E05__C03: ruta bloqueada por el router (validación de dominio pendiente). Sin propuesta posible.
- Base UI en "Más opciones" (E05__R03__ADOPT_PLATFORM_3, _LICENSE_3, _SECURITY_3, _ACCESS_3, _COST_3): propuestas redactadas como PENDIENTE de evidencia, sin confirmar.
- Recurso v5 (E05__A12__ADOPT_ACCESS_3 y _COST_3): igual, sin confirmar.
- Aún pendientes de la ronda anterior: E05__MOV04_3 (movimiento sin verificar en navegador), E05__AC01_3 (accesibilidad con tecnologías de apoyo), E05__RC01_2 (evaluación por componente, ahora iniciada para uno solo).

### No revisado en esta pasada

- Fase de identidad posterior (D8): Dirección de arte (E05__ART00), Tipografía (E05__T00), Color (E05__K01), Tokens y estados (E05__V01).
- Fuera de esta pasada: Layout y contenido (E05__L00), Escritura (E05__WR01), Revisión de conjunto (E05__QA01).
- Las otras sesiones de componentes (diálogos, drawer, pestañas, desplegable de Tiempo, casillas, formularios y número, Sonner, zustand, clsx, lucide-react).
- Skills aplicables sin revisar (14) y diferidas (12) del inventario.

### Estado final

Revisión 290; 60 nodos aprobados de 75 activos; inventario confirmado; un nodo bloqueado (E05__C03); sin conflictos de inventario; listo para entrega humana: no; sin permiso de ejecución. Exportación: `turno-audit-export.json` en esta carpeta.
