# Ajuste de viewport y pantalla completa

Base: `2074c06dafbadc4603804690c3115b24e6c38d6f`, rama `frontend/auditoria-diseno-v7-completa`.

## Diagnóstico de código

1. El editor tenía máximo 76ch sin repartir el espacio sobrante: quedaba alineado a la izquierda al crecer la ventana. Se centra con margen horizontal automático conservando el ancho de escritura. El shell declara 100% de su contenedor.
2. Al abrir un drawer, render vacía la columna de origen para evitar controles duplicados. Faltaba reconciliar ese estado al volver a columnas visibles. Resize y fullscreenchange devuelven navegación desde 700px y Tiempo desde 1000px si el inspector está habilitado y la vista no es Inicio.

Son defectos del código, no una reproducción visual ni prueba de que sean la única causa del síntoma observado.

## Estado conservado

Las media queries controlan el tamaño fluido. No se calculan anchos en JavaScript ni se escala o recarga la interfaz. La reconciliación solo actúa al cambiar modo de panel: no reconstruye el editor, incluso si editar únicamente una fecha cambió el estado limpio a borrador. Se conservan los nodos, su scroll, borradores, entrada temporal inválida, errores, selección, filtros, pestaña, propiedades y tema.

El foco pasa al control equivalente del panel acoplado y conserva su scroll. Al ocultar columnas en tamaños menores, el foco pasa al botón visible. Los diálogos de creación, confirmación y cambios sin guardar no se cierran por resize. Los avisos se reactivan al acoplar el drawer.

Inicio conserva Tiempo como overlay. Un inspector ocultado explícitamente mantiene su drawer accesible al ampliar sin cambiar esa preferencia. En archivo, aviso y formulario comparten una pista grid de 76ch medida en el padre, evitando diferencias por el texto caption.

## Pruebas reproducibles

`npm test`, `python scripts/build_preview.py`, `node scripts/check_portable.mjs`.

Once pruebas nuevas cubren CSS declarado, 699/700 y 999/1000, ciclos 320–1920px, fullscreenchange simulado, identidad, contenido único, borrador/error, foco simulado, scroll, Agenda, tema, filtros, propiedades, inspector oculto, Inicio y confirmaciones. El HTML autónomo prueba también acoplamiento y regreso a móvil con entradas inválidas. Se utiliza además un harness independiente.

## Límites

Node y LinkeDOM no renderizan CSS ni ejecutan pantalla completa nativa. No hay capturas, medición de píxeles, foco nativo ni pruebas reales de zoom/dispositivos. No se eludió file:// mediante localhost, CDP ni otro navegador. Antes de aceptación visual hay que probar el HTML en un navegador permitido: fullscreen repetido, resize, zoom 200%, temas y altura baja. No se mezcló ni desplegó este cambio.
