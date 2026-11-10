# Ejecución aislada 3A · candidato en revisión

## Base y alcance

Rama local `phase-3a-local`, base documental inicial `0bbdfb5c315b343251f9bec7d44278671a883900`, actualizada mediante fast-forward documental aprobado a `199ac88b3b3e282690a8f3b97d0b3b13496f0012` antes de la congelación final. Misma fuente funcional previa que `76943e5db6cf203e8f2738391f4318523c63ad7b`, G2B técnico aprobado antes de iniciar esta tarea. No se amplió PR #2 ni se publicó código.

Se siguieron contrato común/implementador, PLAN 3A, D1–D12 pertinentes, EXECUTION_LESSONS y EXTRA-NATIVE-EDIT. Design Skills Router 0.2.1 instalado fue leído como referencia (design-tree/PILOT/ASSISTANCE/CLI); no se migró el ledger histórico ni se inventó aceptación del helper. Se preservan identidad, fuentes, tokens y flor locales de v5. No es un rediseño.

## Dueños e interfaces

- Store de sesión: snapshot confirmado, selección/draft/temporal/errores, vista/filtros/búsqueda, listas expandidas y preferencia inspector. El store guarda también la pila única del reducer de overlays. El Provider controlado la consume, sin estado paralelo por panel. Los harness anteriores conservan su provider local independiente por montaje.
- `setCompleted(id, completed)` usa el `port.saveTask` existente y el lock de persistencia compartido. Parte del Task confirmado, cambia sólo completed y actualiza snapshot tras éxito. Fallo/conflicto/latencia no alteran draft/raw/errores/selección. Noops y turnos cerrados no operan.
- `getPanelMode(width)` tiene umbrales independientes 700/1000. AppShell aplica excepciones Inicio/preferencia hidden. No anida main. Cada panel mantiene contenedor de portal y controles estables; docking cambia modalidad/CSS, no reparenta. Al dockear se elimina la capa efímera y el disclosure asociado, sin reabrir al estrechar. Foco de retorno rechaza hidden/inert/display:none/visibility:hidden.
- Producto arranca una sesión fuera de StrictMode y conserva el sorteo inyectado una vez. No incorpora el controlador de historial del harness al producto ni crea un segundo handler de popstate. La integración de guardas con editores continúa en 4A/4B.

## Artefactos y clases de evidencia

1. `dist/preview.html`: App real parcial, Home/Navigation/store/puerto/MoreOptions/Demo/AppShell. Edición/Tiempo/Agenda son espacios identificados; creación, cierre y archivo no disponibles están deshabilitados.
2. `dist-layout/layout-harness.html?fixture=product-long`: el mismo App real, sesión/store/puerto, con snapshot sintético de frontera y nombre de 300 caracteres. No monta los slots del EXTRA. No añade globals ni acceso de prueba al producto normal.
3. `dist-layout/layout-harness.html`: LayoutHarness técnico con textarea/input/TemporalField, propiedad y scroll para probar docking, selección/caret/undo/raw y composición por eventos. No acredita componentes futuros.
4. `dist-history/history-harness.html`: regresión técnica 2B, sin convertirla en integración de HISTORY.

Por caso de navegador se conserva cuál artefacto/composición se ejecutó. Una captura provisional no certifica otro snapshot. El gate final necesita sus hashes, logs y revisión independientes.

## TDD y correcciones incrementales

Se conservaron RED por assertions y GREEN: completion real (confirmado vs cero operaciones), límites de panel, navegación/disclosure, docking sin capas fantasma, contexto vacío de Home sin perder selección, cierre del disclosure al dockear y fallback fullscreen técnico. Los scaffolds iniciales permitieron comprobar ausencia conductual sin imports rotos.

La revisión independiente detectó y se corrigió deriva inicial de flor/copia/filtro extra. Se restauraron textos de v5 (salvo Lista por D7), opciones de apariencia, anatomía de navegación y etiqueta Reabrir al completar. Los primeros renders son WIP, no referencia final.

Dos diagnósticos de tests quedan explícitos: un primer test de Demo móvil observaba sólo aria-visibilidad y pasó sin detectar capa restante; se reforzó con el estado real y se reprodujo RED contra la secuencia anterior antes de restaurar el fix. El primer check de fullscreen identificaba ambiguamente dos regiones status (output y fallback); se añadió nombre accesible y se verificó el mensaje exacto, sin relajar el comportamiento. No se ocultaron esos resultados ni se contaron como cierre.

## Verificación y estado de paridad

Los logs de RED/GREEN y verificaciones se guardan en `evidence/3A/`. Tipos/lint/unit/component/builds y auditorías total/runtime se ejecutan sobre el candidato. Chromium/portable/zoom nativo se verifican en Mac autorizado; el arranque Chromium previamente denegado en nube no se reintenta por otra ruta. PASS/FAIL/BLOCKED/NOT RUN permanecen distintos.

El ajuste documental aprobado conserva las 212 identidades: 16 cierres completos corresponden a G3 y DESIGN-AUDIT-02 conserva su preparación parcial en 3A, con cierre íntegro en 4A. DESIGN-AUDIT-02 en v5 incluye también checkbox de editor, ausente hasta 4A: la navegación nativa de 44px puede probarse ahora, pero no se presenta esa evidencia parcial como cierre del contrato completo. La dependencia se resolvió en el commit documental citado, sin que la implementación cree un editor para conseguir verde. El resto tampoco se marca verified antes de evidencia/revisión final. HISTORY y requisitos futuros siguen planned.

Estado: candidato en revisión. No es APPROVE_PHASE ni cierre de G3. No IME manual, lector de pantalla, dispositivo real, motores adicionales o host certificado. No se aceptan capturas/eventos simulados como sustituto de esas pruebas.


## Excepciones acotadas revisadas

- Home.tsx: la máscara del play ya tenía un defecto en 0bbdfb5. Vite emite apóstrofes dentro del data URL SVG; CSS url() sin comillas se descarta y pinta un cuadrado. Se conserva el mismo asset y se escapa la URL con JSON.stringify. El RED de Chromium confirmó maskImage:none y CSS.supports:false para la URL original; la regresión exige máscara válida, esquina transparente y trazo visible.
- offline-theme.spec.ts: Navigation real ocupa ahora (2,2) con sidebar #202120. La corrida anterior dio FAIL en la aserción final de canvas de 1A. Se mantienen ese punto/frames/umbral ≤64; se añade punto geométricamente dentro de main.home (verificado con elementFromPoint), se muestrean los mismos PNG y se exige también ≤64 en todos sus frames y el RGB final de canvas original [23,24,23]. No se pinta alrededor de una coordenada de prueba ni se cambia el umbral.
- La lectura de fuentes públicas concretas de accesibilidad/layout/tipografía/colores se reforzó durante la revisión correctiva, con el pin del Router 157da62016338e8693dcff93d47154a9e36f2157 y blobs verificados. No se atribuye esa recuperación a una lectura anterior. Los criterios corroboran la autoridad del diseño v5, no autorizan paleta, tipografías ni rejilla nuevas.

## Auditoría de iconografía antes de continuar

Se pausó la implementación para completar la revisión de iconos solicitada. La revisión confirmó familia Lucide y assets existentes; no autorizó una sustitución de estilo ni aumentar todos los trazos. Tras recibir su dictamen y autorización de continuación, se restauró la geometría de prioridad de v5 (flecha14, mismo path), X20 con nombre accesible, chevron/lápiz/plus20 por fila, engranaje20 de Demo y lupa20 no encogible. Navegación/footer conservan su contexto16. Los controles iconográficos de toolbar recuperan objetivo44×44, sin presentarlo como mínimo AA universal.

Se corrige además la deriva visual de drawer/disclosure: ancho min(340px,100vw−20px), padding16/12 con safe areas, X y posición fuente de Cerrar turno deshabilitado. El popup se ancla al footer real mediante el ref público anchor de Base UI y toma su --anchor-width; la prueba compara geometría real a320/390/700/800/1440, no un único ancho fijado artificialmente. No cambia el dueño de estado, el contenedor del portal ni el montaje de los campos. La validación visual debe repetirse sobre el artefacto resultante, no heredarse de candidato4.


La comprobación del dimensionado público detectó que Base UI redondea el ancho del anchor a píxel de dispositivo: duplicar el valor del botón de media columna puede introducir1px. Se evita esa acumulación usando el footer como ancla, sin aumentar tolerancias ni medir con un estado paralelo. Un RED adicional reprodujo el disclosure huérfano al cruzar700→699; se cierra su capa en ambos sentidos y sólo se recupera el foco que poseía la capa. Apertura con puntero/Enter y ambos destinos visibles llevan regresiones específicas.
