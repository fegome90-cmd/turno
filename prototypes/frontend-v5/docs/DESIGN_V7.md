# Turno · Ajustes de diseño v7

Base: `22fd3df0fbb4662bead487d6490d5508819062ba`, rama `frontend/toast-expandido-v6`.

Prototipo de frontend independiente. No cambia el plugin oficial, backend, contratos, persistencia, API ni autenticación. Los datos de ejemplo son sintéticos. No es una release ni un despliegue.

## Correspondencia con la auditoría recibida

La auditoría visual recibida corresponde a v5. Sirve de referencia de problemas; no es una verificación visual propia de v7.

| Antes | Después | Por qué |
| --- | --- | --- |
| Pie con tres acciones verticales, antes de una zona de árbol pequeña. | Pie con una fila de tres acciones rotuladas; acciones principales agrupadas y notas secundarias después del árbol. Scroll independiente y fallback de scroll completo en alturas bajas. | Dar más espacio al trabajo sin ocultar Archivo, Cerrar turno ni Demo local. |
| Casillas visibles de 19 o 23 px sin un contenedor táctil amplio. | El input nativo permanece dentro de un label de 44×44 px, separado del botón que abre la tarea. Apariencia nativa en colores forzados. | Ampliar la zona de pulsación sin confundir seleccionar con completar. |
| Prioridad alta solo en el selector del editor. | Flecha y texto «Alta» tanto en árbol como en Agenda. El nombre accesible incluye «Prioridad». | Reconocer el estado sin depender del color. Refleja datos confirmados, no borradores sin guardar. |
| Filtro activo con un relleno de contraste bajo. | Se conserva el relleno, con borde oscuro, subrayado, peso y aria-pressed. | Hacer perceptible la selección con varias señales. |
| Motivo de 115 px, campos confundidos con texto fijo. | Motivo flexible, labels visibles para motivo/prioridad, bordes y superficie de edición en título, metadatos y notas. | Mostrar qué se puede editar y permitir motivos largos. |
| Varias capas sucesivas de CSS y tamaños aislados. | Reglas repetidas consolidadas, un bloque de tokens base, escala por rol en componentes ajustados y radios compartidos. | Reducir cruces de cascada sin cambiar la familia tipográfica ni añadir un motor de animación. |
| Cortes arbitrarios en palabras de la navegación. | Corte de emergencia y guionado, con min-width:0 en flex-items que pueden crecer. | Mantener palabras legibles y reservar espacio para acciones laterales. |
| Notas limitadas por un ancho distinto de su pie. | El formulario comparte un límite de ancho; el área de escritura ocupa su ancho y alinea el texto con su encabezado. El pie puede envolver. | Mantener bordes y acciones dentro de la misma columna. |
| Pestaña seleccionada capturada por el hover genérico. | El hover genérico excluye aria-selected=true y el seleccionado conserva su superficie. | Evitar que el hover parezca cambiar la selección. |
| «Más opciones» abría un diálogo con una sola acción duplicada. | Se elimina ese paso redundante. Cerrar turno sigue visible en el pie y conserva su confirmación. | Evitar un modal que no aporta una elección. |
| «Abrir turno» aun cuando ya estaba activo; «Task 1» en los datos. | «Ir al turno» cuando está activo, «Iniciar turno» cuando no lo está, y «Tarea 1» en el ejemplo. | Ajustar las palabras al estado y mantener el español. |

## Decisiones conservadoras

- El saludo y el catálogo de cuatro frases permanecen. No se sustituye la pantalla de Inicio por una tarjeta ni una acción nueva.
- `motion.mjs`, `toasts.mjs`, el catálogo de frases y los parámetros de movimiento permanecen sin cambios. Se conservan las rutas de teclado y movimiento reducido.
- Se conserva la paleta clara. El modo oscuro queda como decisión de producto pendiente, no como funcionalidad implementada.
- Las caras que usa la interfaz tienen sus fuentes declaradas: Source Sans 3 normal 400/600/700 y Source Serif Pro normal/itálica 400. Dos archivos disponibles de la base (Sans itálica y Serif semibold) se conservan como assets, pero no se añaden @font-face ni cargas innecesarias para usos inexistentes. No se cambia la pareja tipográfica.
- La nueva flecha de prioridad es un SVG geométrico propio. Los assets previos y sus licencias se conservan.

## Verificación reproducible

Desde `prototypes/frontend-v5/`:

```sh
npm test
python scripts/build_preview.py
node scripts/check_portable.mjs
```

La suite cubre los flujos existentes y añade regresiones de navegación, casillas, prioridad guardada y fallida, metadatos largos, filtros, drawer móvil, archivo, copy y contratos CSS. LinkeDOM requiere un shim documentado en la prueba de prioridad para corregir su setter de option.selected; eso no prueba un control nativo.

El HTML portátil se construye y ejecuta como módulo en un DOM simulado. También se comprueba la sintaxis de los módulos y se analiza el CSS sin renderizar.

## Límites

No se abrió ni renderizó la aplicación en un navegador. No hay capturas propias de v7. Los tests no demuestran geometría pintada, visibilidad real del árbol, interacción táctil, foco nativo, lectores de pantalla, teclado virtual, zoom, forced-colors, fluidez o compatibilidad móvil.

El contraste automatizado usa los colores declarados, no píxeles pintados. Antes de integrar, sigue pendiente QA visual en 320/390/768/1024/1440 px, altura baja, 200% de zoom, navegadores y dispositivos reales, y revisión de accesibilidad. Los fallos observados durante esas pruebas deben corregirse antes de declarar la interfaz lista para producción.
