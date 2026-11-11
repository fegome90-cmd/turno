# Matriz API → necesidad → evidencia → resultado · Fase 1B (tras D11 y D12)

Versiones de primitivas verificadas en `node_modules`: `@base-ui/react` 1.9.0. Clases de evidencia: **C** = componente (jsdom, no visual), **E** = navegador real Chromium (Playwright), **M** = manual/AT (no ejecutado aquí). `NOT RUN` = no probado en 1B. Nada de esto cierra filas de paridad de editor, layout ni pila: el harness no cierra filas (brief, prohibiciones).

| Primitiva / API | Necesidad (contrato) | Evidencia (ID, clase) | Resultado | Adaptación pendiente |
|---|---|---|---|---|
| `NumberField.Root` / `NumberField.Input` | Texto crudo exacto, sin clamp, vacío ≠ 0 | Sonda en `evidence/1B/numberfield-probe-output.txt` (fuera de la suite) | **REJECTED (D11)**. `abc` se descarta; es-CL: `1.5`→`15`, `1441`→`1.441`, `1000`→`1.000` tras blur; en-US: `1441`→`1,441`. Los 3 casos de la suite (`G1B-NUMBERFIELD-RAW`) se retiraron, sin `skip`. | No se usa en Turno. Minutos y hora: TemporalField. Panel, tema y docking con NumberField: NOT RUN. |
| `Field.Root` (`invalid`), `Field.Label`, `Field.Control`, `Field.Description`, `Field.Error` (`match={true}`) | Campo crudo con error v5 visible y nombre accesible | G1B-TEMPORAL-RAW ×8 (C), TemporalField (`src/components/TemporalField.tsx`) | PASS (`abc`, `-1`, `1.5`, `1441`, vacío, `0`, `1440`, `999`, `1000`, hora 24 h, regla de minutos) | `Field.Error` sin `match` no muestra un error propio: se usa `match={true}`. |
| `Drawer.Root`, `Portal`, `Viewport`, `Popup`, `Title`, `Close` (controlado) | Navegación modal bajo Popover; Escape cierra solo el topmost | G1B-OVERLAY-01/02/03 (C), G1B-OVERLAY Escape (E) | PASS | `Drawer.Viewport` es obligatorio (sin él, Base UI avisa y pierde swipe/scroll-lock). Swipe, táctil y animaciones: NOT RUN. |
| `Popover.Root` (`modal={false}`), `Trigger`, `Portal`, `Positioner`, `Popup`, `Title` | Tema no modal dentro de Drawer; Tab sale (D2) | G1B-OVERLAY-01/04 (C), G1B-OVERLAY Tab (E) y «Popover no modal» (E): tras Tab el foco sale y la página no queda inerte | PASS | Posicionamiento real y colisiones: NOT RUN. |
| `Dialog.Root`, `Portal`, `Popup` (`finalFocus`), `Title`, `Close` | Diálogo con foco de retorno visible; resto inerte | G1B-OVERLAY-02/03/05 (C); G1B-OVERLAY Drawer → Dialog (E: Escape, foco al control del Drawer, Tab dentro del Dialog, pila y Drawer inertes) | PASS en componente y en Chromium. `finalFocus` resuelve `data-focus-key` solo si está conectado y no inerte. | `Dialog.Backdrop` no usado. Base UI pasa por su guardia de foco y devuelve el foco al Dialog (se espera ese retorno). Que el coordinador retire el Popover se prueba con el reductor puro (G1B-OVERLAY-06). |
| `AlertDialog` | Confirmaciones | — | NOT RUN | 2A/4B. |
| `Tabs` | — | — | NOT RUN | No usado en 1B. |
| `Collapsible` | — | — | NOT RUN | No usado en 1B. |
| `Checkbox` | — | — | NOT RUN | No usado en 1B. |
| `Select` | — | — | NOT RUN | No usado en 1B. |
| Pila propia `NotificationStack` (D12) | Solo pinta el store; sin expulsión; presupuesto de desplazamiento | G1B-NOTIFY-01 (C, 30 avisos), e2e 30 avisos (E) | PASS. `notice-list` con `max-height:min(40dvh,420px)` y `overflow-y:auto`. | Sin FLIP ni movimiento (5A/6A). |
| Pila: regiones vivas | Estado polite/status (`#live`); error assertive/alert (`#live-error`); un solo anuncio | G1B-NOTIFY-03 (C) | PASS. Mutación «errores a región cortés» → código 1. | Sin pruebas con lector de pantalla (M). |
| Pila: suspensión | Modal abierto: región inerte y oculta; anuncio diferido | G1B-NOTIFY-04 (C), e2e Drawer → inert (E) | PASS. Mutación «sin inert» → código 1. | — |
| Pila: Escape | Cierra solo el aviso enfocado; foco al cierre siguiente | G1B-NOTIFY-08 (C), G1B-NOTIFY Alt+T/Escape (E, Chromium) | PASS en componente y en Chromium. Mutación «sin Escape» → código 1. | — |
| Pila: Alt+T | Foco al aviso más reciente, sin foco automático al llegar | G1B-NOTIFY-09 (C), G1B-NOTIFY Alt+T (E) y «llegada no mueve foco» (E) | PASS en componente y en Chromium. Mutación «foco al llegar» → código 1. | — |
| Pila: descarte con foco | Teclado: siguiente, luego anterior, luego respaldo; puntero no mueve foco ajeno | G1B-NOTIFY-05/06/07 (C), e2e intermedio (E) | PASS | — |
| Pila: texto literal y éxito | Sin HTML; un aviso no válido no devuelve id | G1B-NOTIFY-10/11 (C) | PASS | — |
| Sonner | Presentación de avisos | — | **REMOVED (D12)**. `sonner` se desinstaló (solo cambian sus entradas en package.json y lock). Los hallazgos siguen registrados abajo. | — |

## Hallazgos Sonner 2.0.8 (con evidencia de 1B; motivo de D12)

- Sin registro controlado: estado global de módulo; un Toaster nuevo recibe los toasts activos.
- Retención: `duration: Infinity` no cierra por tiempo (G1B-NOTIFY, con Sonner).
- Suspensión: sin prop pública; `inert` en el contenedor era la única vía.
- `aria-live="polite"` fijo en el contenedor, sin opción pública: los errores de v5 son urgentes (brecha, D12).
- Escape: solo colapsa la pila, no cierra el aviso enfocado (brecha, D12).
- Foco al descartar: dependía de `data-close-button`/`data-testid`, que no son API pública.
