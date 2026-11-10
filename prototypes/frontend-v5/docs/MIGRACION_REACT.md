# Plan de migración a React · v6

> **Propuesta inicial histórica.** El [plan auditado, la matriz de 212 requisitos y el estado de preparación](../../../docs/migration-v6/README.md) amplían y precisan este documento. Leerlos antes de implementar. G0 sigue pendiente; esta actualización solo publica documentación.

Estado: **propuesto**. No hay código de la v6 todavía. Base: rama `frontend/fix-fullscreen-reflow-v8` en `7141568`.

## Objetivo

Reemplazar los componentes construidos a mano en la v5 por las librerías de la lista curada de Emil Kowalski
([`pick-ui-library`](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/pick-ui-library/SKILL.md), MIT),
sin perder lo ya verificado: correcciones de los PR #1 y #2, accesibilidad, historial, textos y temas.

Esto revierte de forma explícita la excepción documentada en [`MOTION_V6.md`](MOTION_V6.md) («No se instaló Sonner ni React»):
la v5 sigue vanilla; la v6 adopta React para no reconstruir primitivas que ya existen.

## Dónde y cómo

- Carpeta nueva `prototypes/frontend-v6/`, rama propia y un PR por fase. `frontend-v5/` queda intacta como referencia y como fuente de las pruebas de comportamiento.
- Cada fase: especificación → implementación → verificación independiente en Chromium → revisión antes de subir.
- Sin backend, autenticación, API ni persistencia, igual que la v5.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Framework | React 19 + TypeScript + Vite | Las librerías de la lista requieren React; Vite permite un HTML autónomo. |
| Primitivas de UI | **`@base-ui/react`** | Recomendación de la lista. Trae `Drawer` con deslizamiento, `Tabs.Indicator`, `Field`/`Form`/`NumberField`. |
| Router | Ninguno | Un router cambiaría la URL y rompería `preview.html` desde `file://`. Se porta el hook de historial con índice y `history.go()`. |

Consecuencia de elegir base-ui: `ui-kit` usa Radix, así que Turno no consumirá sus componentes tal cual. Se puede reutilizar diseño y tokens, no los componentes.

## Librerías

| Necesidad | Librería | Origen | Reemplaza en v5 |
|---|---|---|---|
| Diálogos y confirmaciones | `@base-ui/react` Dialog / AlertDialog | lista de Emil | `<dialog>` + foco manual |
| Paneles móviles (navegación, Tiempo) | `@base-ui/react` Drawer | lista de Emil | `<dialog class="drawer">` |
| Más opciones | `@base-ui/react` Menu (Popover si contiene el selector) | lista de Emil | sección mostrar/ocultar |
| Pestañas Tarea / Agenda | `@base-ui/react` Tabs + `Tabs.Indicator` | lista de Emil | ARIA manual + FLIP en `motion.mjs` |
| Propiedades de Tiempo | `@base-ui/react` Collapsible | lista de Emil | `<details>` + animación propia |
| Casillas, prioridad, tema | `@base-ui/react` Checkbox, Select | lista de Emil | nativos estilizados |
| Formularios y errores por campo | `@base-ui/react` Field / Form / NumberField | lista de Emil | `validation.mjs` + `aria-describedby` manual |
| Avisos | Sonner | lista de Emil | `toasts.mjs` |
| Tema claro / oscuro / sistema | next-themes (`attribute="data-theme"`) | lista de Emil | `theme.mjs` |
| Animación que CSS no resuelva | motion (`motion/react`) | lista de Emil | WAAPI de `motion.mjs` |
| Estado global | zustand | lista de Emil | variables `let` en `app.mjs` |
| Clases condicionales | clsx | lista de Emil | plantillas de texto |
| Iconos | lucide-react | fuera de la lista (coherente con `ui-kit`) | SVG en máscara |
| HTML autónomo | vite-plugin-singlefile | fuera de la lista | `build_preview.py` |
| Pruebas | Vitest + Testing Library + Playwright | fuera de la lista (coherente con `ui-kit`) | LinkeDOM + `node --test` |

Sin librería: `format.mjs` (America/Santiago, DD/MM/AAAA), `preview-adapter.mjs`, `validation.mjs` y `draft-state.mjs` pasan a TypeScript sin cambiar su lógica.
No aplican: cmdk, input-otp, recharts, Liveline, dnd kit, Virtuoso, NumberFlow, cva (sin Tailwind).

Pendiente de comprobar en la fase 1: next-themes está pensado para Next. Si en Vite hay parpadeo de tema al cargar, se sustituye por un proveedor propio basado en `theme.mjs`.

## Fases

### Fase 0 · Decisión y contrato
- ADR con las decisiones de arriba e inventario de comportamientos obligatorios derivado de las 212 pruebas de la v5 (criterio de aceptación de todo el plan).
- Skills: `engineering:architecture`, `design-process-orchestrator` (my-skills, modo Refactorización), `pick-ui-library` (Emil), `engineering:testing-strategy`.
- Hecho cuando: ADR aceptado y lista de criterios trazable a su prueba de origen.

### Fase 1 · Proyecto, tokens y tema
- Vite + React + TS; fuentes Source Sans 3 y Source Serif con licencias; tokens claro/oscuro del PR #2 como variables CSS; next-themes o proveedor propio; primer HTML autónomo.
- Skills: `design-tokens-components` (my-skills), `better-colors` (Jakub), `typography-scales-microtype` y `better-typography`, `mobile-native` (Emil).
- Hecho cuando: sin parpadeo de tema, el HTML abre desde `file://` sin red, contrastes ≥ 4.5:1 en ambos temas, peso del HTML medido.

### Fase 2 · Estado y dominio
- Store zustand (turnos, camas, tareas, notas, selección, borrador, `dirty`, `busy`, filtros); módulos de dominio en TS; hook de historial con índice, `go(delta)` y título de pestaña.
- Skills: `state-machine` (Jakub), `authority-flow-audit` (my-skills).
- Hecho cuando: pasan las pruebas portadas de `preview`, `validation`, `draft` e `history`, incluidos Atrás/Adelante con cambios sin guardar.

### Fase 3 · Estructura y navegación
- Tres columnas que pasan a `Drawer` bajo 1000 px; barra lateral con acciones en una columna, señal de scroll, Archivo y Más opciones (Menu con selector de tema); barra superior sin desborde y «Cerrar turno» como icono bajo 400 px.
- Skills: `layout-grid-hierarchy` y `better-layout`, `better-accessibility`, `mobile-native`, `animate` (Emil; curva de panel `cubic-bezier(0.32,0.72,0,1)`, ≤ 300 ms).
- Hecho cuando: sin scroll horizontal a 320 px con nombres largos; Atrás cierra panel/menú sin perder el historial hacia adelante.

### Fase 4 · Editor, Tiempo y Agenda
- Título como textarea que crece, Enter guarda y respeta IME; Motivo y Prioridad con `Field`; casillas de 44 px con `Checkbox`; `Tabs.Indicator`; `Collapsible`; fecha/hora como `Field` de texto validado y estimación con `NumberField`; insignia «Alta» con icono y texto; diálogos con `Dialog`/`AlertDialog`.
- Skills: `emil-design-eng` y `animate` (Emil), `better-ui` y `better-writing` (Jakub), `ui-motion-and-handoff` (my-skills), `break-ui` (Emil) y `break` (Jakub).
- Hecho cuando: pasan las pruebas portadas de `ui`, `interface-skills`, `polish` y `design-audit`; con movimiento reducido solo quedan fundidos de opacidad.

### Fase 5 · Avisos con Sonner
- `<Toaster>` con `duration: Infinity`, `expand`, `closeButton`, `hotkey` Alt+T e `id` estable para agrupar repetidos; los errores siguen siendo urgentes para lector de pantalla.
- Skills: `ask-sonner` (Emil), `review-animations` (Emil), `better-accessibility`.
- Hecho cuando: pasan las 22 pruebas de comportamiento de `toasts.test.mjs` portadas; lo que Sonner no cubra queda documentado.

### Fase 6 · Movimiento final
- Sin motion por defecto; solo si algo no se resuelve con CSS, base-ui o Sonner.
- Skills: `find-animation-opportunities`, `remove-animations`, `animation-performance`, `review-animations` (Emil).
- Hecho cuando: nada se anima con teclado, nada pasa de 300 ms, se respeta el movimiento reducido y la revisión de animaciones da Approve.

### Fase 7 · QA, auditoría y PR
- Playwright en Chromium: colores forzados claro y oscuro; 320, 390, 1024 y 1440 px; WCAG 1.4.12; movimiento reducido; Atrás/Adelante; IME por CDP; pantalla completa y redimensionado; consola sin errores.
- Skills: `better-interface` e `interface-review` (Jakub), `design:accessibility-review`, `learned-structured-review` (my-skills), `code-review`.
- Hecho cuando: veredicto Approve, criterios de la fase 0 cumplidos y PR con lo verificado separado de lo no verificado.

## Riesgos

- **Pruebas:** las de la v5 usan LinkeDOM y regex sobre CSS. Las de comportamiento se portan; las que fijan implementación se reescriben contra el resultado visible.
- **Paridad de avisos:** posición al leer y foco al cerrar el aviso enfocado pueden diferir en Sonner (fase 5).
- **Peso:** React, base-ui y Sonner hacen crecer el HTML autónomo (v5 ≈ 1 MB); se mide en la fase 1.
- **Memoria del entorno:** las pruebas corren con concurrencia 1.

## Fuentes

- Skills de Emil Kowalski: `emilkowalski/skills` @ `c8a79627b59d72d764d6ab6f2c87c09a48169833` (MIT, `licenses/EmilKowalski-skills-MIT.txt`).
- Skills de Jakub Krehel: `jakubkrehel/skills` @ `157da62016338e8693dcff93d47154a9e36f2157` (MIT, `licenses/JakubKrehel-skills-MIT.txt`).
- Base UI v1.9: componentes `Drawer` y `Tabs.Indicator` confirmados en su documentación.
