# Turno · Diseño v7 completado en código

Base de esta ampliación: `70645e0841a6e07bac2d0a983174086b5d1c2671`, rama `frontend/auditoria-diseno-v7`. La primera etapa partió de `22fd3df0fbb4662bead487d6490d5508819062ba`.

Frontend independiente, sin cambios al plugin oficial, backend, contratos, API, autenticación o persistencia. Datos sintéticos en memoria. No es una release, integración ni despliegue.

## Correspondencia completa con el informe

Todos los puntos tienen una implementación o excepción explícita en código. Esto no equivale a aceptación visual ni a conformidad de accesibilidad comprobada en navegador.

| Punto | Implementación | Verificación disponible |
| --- | --- | --- |
| B1. Espacio del árbol | Pie con Archivo y Más opciones en una fila. Demo local y aviso de reinicio pasan al desplegable. Cerrar turno está en la barra superior y en la cabecera del drawer móvil, conservando confirmación. Árbol antes de notas, scroll propio y fallback de altura baja. | Estructura, acceso, cierres y foco simulado. Sin medición de tareas visibles. |
| W1. Casillas táctiles | Input nativo de 19/23 px en label exclusivo de 44×44 px. No comparte pulsación con abrir tarea. Apariencia nativa en forced-colors. | DOM y contrato CSS. Táctil real pendiente. |
| W2. Prioridad | Flecha decorativa y texto Alta con nombre accesible Prioridad Alta en árbol y Agenda. Refleja solo datos confirmados y se conserva en archivo. | Guardado, fallo, cambio a Baja y archivo simulados. |
| W3. Jerarquía | Título de tarea 2.125rem (34 px con raíz de 16), 2rem (32 px) hasta 1100 px. Marca 1.25rem (20 px). El botón Ir al turno actual no tiene borde visible; Iniciar turno sí conserva borde. | Contratos CSS, sin jerarquía pintada verificada. |
| W4. Palabras y saludo | Ir al turno actual / Iniciar turno según estado. Se conserva Hola con nombre del perfil y el catálogo de cuatro frases. Nombre y frase permanecen estables durante la visita; solo se elige la frase al cargar. | Estados, perfil personalizado y catálogo. La demo pública usa Demo. |
| W5. Tipografía | Seis roles en rem: caption .8125, small .875, body 1, writing 1.1875, section 1.25 y title 2.125. Metadatos 13 px con raíz de 16. Campos en móvil/puntero grueso al menos 1rem. | No quedan font-size literales en px. Inicio conserva su escala expresiva fluida como excepción deliberada. |
| W6. CSS | Bloques base, componentes, estados y modos de entrada; colores de componentes tokenizados para ambos temas. Sin capas históricas de overrides. | Parser CSS y ausencia de selector exacto repetido por contexto. |
| W7. Filtros | Selección con borde, subrayado, peso, relleno y aria-pressed. | Contraste de colores declarados y retención de borrador/scroll. |
| W8. Edición y motivo | Bordes y superficies permanentes en título, motivo, prioridad y notas. Labels visibles; motivo ocupa flex/width disponible. | Motivo largo, borradores y validación simulados. |
| W9. Oscuro | Apariencia Clara, Oscura o Usar el sistema en Más opciones. Sigue cambios del sistema solo en modo sistema. Es una preferencia de la sesión; no guarda datos. | Estado funcional, cambio de sistema, fallback sin matchMedia, metadatos de tema, borrador/error, guardado y archivo en oscuro. |
| S1. Palabras largas | min-width:0, overflow-wrap:break-word e hyphens:auto en navegación y tareas. | Contratos CSS. Guionado real pendiente. |
| S2. Ancho de escritura | El formulario limita todo el editor a 76ch. Notas y pie comparten ese borde; se elimina la excepción de textarea a 72ch desde 1600 px. | Un solo límite declarado, sin geometría real verificada. |
| S3. Radios | Solo dos tokens no nulos: control 6 px y panel 10 px. Casilla, avisos e indicador usan esos tokens. | Contrato CSS. Radios cero de pestañas, links separadores y drawers son excepciones estructurales deliberadas, no una tercera escala. |
| S4. Más opciones | Desplegable no modal con botón aria-expanded/aria-controls, controles en orden Tab, Escape con retorno y cierre exterior. Sin rol menu ni trampa de foco: contiene un select nativo y controles ordinarios. | Toggle, Escape, foco exterior, identidad del control antes del click y flujo móvil simulados. |
| S5. Fuentes | Se eliminan SourceSans3-It.woff2 y SourceSerifPro-Semibold.woff2, que no se usaban (230.552 bytes). Permanecen las cinco caras usadas y todas sus licencias. | Cada asset restante está referenciado, build autónomo y licencias conservadas. |
| S6. Hover seleccionado | El hover genérico excluye selected/active/current/primary y aria-selected=true. Seleccionado mantiene su superficie. | Selectores y contratos de estado, sin hover pintado. |
| S7. Español | El ejemplo usa Tarea 1. | Fixture y DOM simulado. |

## Temas y contraste

La paleta oscura usa superficies #171817/#202120, texto #f2f3f0 y secundario #bbc0ba. No invierte mecánicamente la escala clara. Los componentes comparten tokens para campos, foco, estado activo, hover, pulsación, error, deshabilitado, diálogos, avisos y selectores nativos. Los iconos de imagen y la marca se adaptan al fondo; seleccionados y botones primarios conservan su contraste inverso. `color-scheme` y `theme-color` siguen el tema efectivo.

Las pruebas calculan ratios desde los tokens CSS reales: texto normal ≥4.5:1 en superficies opacas utilizadas; borde de campos, filtro y foco ≥3:1 donde corresponde. Deshabilitados y sombras no se presentan como texto conforme. Son cálculos de valores declarados, no mediciones de píxeles pintados.

## Perfil público y preview privado

El fixture público usa Demo y no contiene identidad personal. El saludo consume el nombre del perfil. Para una copia local personalizada puede ejecutarse `python scripts/build_preview.py --preferred-name "Nombre de prueba"`. Ese argumento solo añade el nombre al HTML generado, que está excluido del repositorio. No introducir datos de pacientes ni compartir ese HTML personalizado sin revisar su contenido.

## Comprobaciones reproducibles

```sh
npm test
python scripts/build_preview.py
node scripts/check_portable.mjs
```

La suite usa LinkeDOM para estados y DOM simulado y CSSOM para parseo. Sus shims de focus/showModal/close y option.selected no son evidencia de controles nativos. El build incluye explícitamente theme.mjs y todos los assets utilizados. El HTML portátil se ejecuta también como módulo en DOM simulado.

## Límites y revisión antes de integrar

No se abrió ni renderizó esta versión en navegador. No hay capturas propias ni QA visual. No se usaron rutas alternativas de navegador. No se demuestran geometría pintada, espacio visible del árbol, foco nativo, tacto, lectores de pantalla, teclado virtual, zoom, forced-colors real, fluidez o compatibilidad de dispositivos.

Queda pendiente QA en ambos temas a 320/390/768/1024/1440/1600 px, altura baja y zoom 200%, con teclado y dispositivos reales. Deben corregirse los problemas observados antes de declarar la interfaz lista para producción. No se ha mezclado ni desplegado este trabajo.
