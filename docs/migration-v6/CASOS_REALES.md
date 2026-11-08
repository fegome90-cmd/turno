# Casos reales y riesgos para la migración

Consulta: 08/11/2026. Las fuentes siguientes son relatos de sus equipos y documentación primaria. Sus incidentes **no son fallos observados en Turno**, ni sus cifras acreditan rendimiento o paridad de este prototipo. Sirven para orientar revisión y pruebas antes de implementar.

## Slack: migrar por una frontera pequeña y medir cada flujo

En [Rebuilding Slack’s Emoji Picker in React](https://slack.engineering/rebuilding-slacks-emoji-picker-in-react/), Slack describe el reemplazo de un componente aislado basado en jQuery/DOM, manteniendo una frontera de integración estricta. Midió mejoras y regresiones distintas por interacción; la virtualización explica buena parte de la mejora, no React por sí solo.

Control incorporado a Turno: mantener v5 como referencia y v6 como aplicación separada, con tareas pequeñas y gates antes de avanzar. Comparar Inicio, apertura de tarea, filtros, guardado y pila de avisos por separado sobre fixtures equivalentes. Medir build de producción y registrar entorno/datos; no adoptar una mejora de mount como prueba de fluidez global. Las mediciones de Turno están pendientes.

## Preply: montaje incorrecto y efectos duplicados

En [Migrating from Backbone.js to React.js without losing it](https://medium.com/preply-engineering/migrating-from-backbone-js-to-react-js-without-losing-it-a8b383a102fe), Preply documenta un montaje React en un lugar incorrecto que generaba una petición de flags por mensaje, y la necesidad de desmontar roots y limpiar integraciones.

Riesgo derivado: un render o remount puede repetir suscripciones, operaciones o inicialización de sesión. Reforzar G1B/G2A/G2B: montar/desmontar repetidamente y bajo StrictMode; comprobar una sesión, un listener por suscripción, un solo guardado y cleanup al salir. En la demo sin red, verificar además que no aparezcan peticiones. No conectar un servicio de flags por imitar el caso.

Los ejemplos antiguos de artículos pueden usar APIs retiradas. Para React 19, consultar [createRoot y root.unmount](https://react.dev/reference/react-dom/client/createRoot); no copiar `ReactDOM.render` ni `unmountComponentAtNode`.

## Heap: dos sistemas no deben poseer el mismo estado

[Migrating to React + MobX while shipping new features](https://www.heap.io/blog/migrating-react-mobx-while-shipping-new-features) describe wrappers de ciclo de vida y la convivencia de sistemas durante una migración incremental.

Riesgo derivado: dos autoridades sobre datos, foco o montaje producen sincronizaciones frágiles. El plan de Turno evita mezclar React y vanilla sobre el mismo DOM. Reforzar una sola autoridad para snapshot confirmado, borrador crudo, navegación y overlays; probar que cerrar un panel o recibir una respuesta tardía no reponga estado antiguo. El caso no prescribe MobX ni wrappers para Turno, cuyo stack elegido sigue siendo Zustand y un puerto de demo explícito.

## HackerRank: escoger una unidad completa revisable

[The State of Front-End Development at HackerRank](https://engineering.hackerrank.com/the-state-of-front-end-development-at-hackerrank/) describe migración de páginas completas de Backbone a React para evitar ambos stacks en una misma página y facilitar SSR, con E2E antes de producción. Aún coexistían páginas antiguas y dos builds; la mejora móvil seguía pendiente.

Control incorporado: una tarea de Turno entrega un resultado o flujo completo revisable, no un número de componentes sustituidos. Los flujos críticos se prueban E2E antes de aceptar la fase que los posee. No se añade SSR ni se adopta migración por rutas: Turno continúa en aplicación nueva aislada y sin router de URL. Responsive mantiene evidencia propia; el artículo no certifica móvil.

## Trello: Context, roots y tokens de tema

[Colorful and accessible theming in Trello](https://www.atlassian.com/blog/how-we-build/colorful-and-accessible-theming-in-trello) explica cómo la convivencia de Backbone y múltiples roots React impedía distribuir todo el tema con un solo Context. Trello usó CSS custom properties y controles de contraste.

Control incorporado: Turno mantiene un root principal y un dueño del tema de sesión. Context sí cruza un portal del mismo árbol, pero no roots independientes; las variables CSS dependen de ancestros DOM. Probar claro/oscuro/sistema con Dialog, Popover y avisos ya abiertos, inspeccionando estilos computados, contraste y foco, incluidos portales a body. No atribuir a este artículo fallos de IME ni importar su arquitectura multi-root.

## GitHub: conservar comportamientos nativos antes de optimizar

En [Crafting a better, faster code view](https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/), GitHub explica problemas al renderizar archivos grandes y decisiones de diseño que recuperaron la búsqueda nativa del navegador tras feedback. Es un caso de evolución de una interfaz React, no una migración equivalente a Turno.

Riesgo derivado: una optimización o primitiva puede conservar lo visible y romper selección, copia, búsqueda o teclado. Reforzar G3/G4A/G7: texto largo/literal, selección y copiar/pegar, caret/undo, Tab, Escape, atajos y Atrás/Adelante. Revisar el foco real tras cierre y remount. Los benchmarks del artículo se hicieron con build de desarrollo para comparar opciones; no se trasladan como latencia productiva ni objetivo de Turno.

## Slack offline: coherencia del artefacto, no solo ausencia de URLs

[Service Workers at Slack: Our Quest for Faster Boot Times and Offline Support](https://slack.engineering/service-workers-at-slack-our-quest-for-faster-boot-times-and-offline-support/) describe problemas de caché por despliegue y desajustes entre flags y assets.

Aplicación acotada: el HTML autónomo de Turno debe abrir y recargar sin red con fuentes, iconos y scripts coherentes del mismo build. G1A/G7A requiere esa ejecución real, no solo una búsqueda estática de imports. Esto **no propone añadir Service Worker, caché persistente, flags ni backend**: siguen fuera del alcance del prototipo. Si se añaden en otro encargo, sus escenarios de actualización/recuperación necesitarán pruebas propias.

## Base UI: una primitiva accesible no certifica la aplicación

La [documentación de accesibilidad de Base UI](https://base-ui.com/react/overview/accessibility) distingue lo que resuelven las primitivas de las responsabilidades de quien compone la interfaz.

Reforzar G1B/G7: nombres accesibles, foco visible/restaurado, contraste, orden de lectura, errores de formularios y composición de Dialog/Drawer/Popover/avisos. Axe y DOM simulado son comprobaciones parciales. Lector de pantalla, táctil, IME y navegación real conservan evidencia separada, como exige el plan.

## Qué aportan estas fuentes

Respaldan mantener fronteras claras, un dueño del estado, lifecycle con cleanup, benchmarks por interacción y preservación de capacidades nativas. No demuestran que la matriz de Turno cubra todo riesgo ni justifican afirmar migración sin pérdida antes de ejecutar y revisar cada gate. Las 212 filas siguen `planned`; los bloqueos del [preflight](PREFLIGHT.md) continúan vigentes.

Los controles derivados están incorporados al [método de ejecución](EXECUTION_LESSONS.md) y al [mapa de riesgos por fase](migration-risks.json). Son obligatorios cuando corresponden a la tarea, sin equivaler a producto implementado ni aceptar las precisiones de UX pendientes. G0 continúa detenido.
