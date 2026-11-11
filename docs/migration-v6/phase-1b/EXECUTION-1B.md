# Ejecución de la fase 1B · contratos de primitivas

Fecha: 09/11/2026. Encargo: [BRIEF-1B](BRIEF-1B.md). Roles: implementador Claude Haiku, orquestador Claude, revisor independiente Claude Sonnet. Registro: `prototypes/frontend-v6/evidence/1B/LOG.md`; matriz de APIs: `evidence/1B/API-MATRIX.md`; revisión: `evidence/1B/review/REVIEW-1B.md`.

**Resultado: G1B aprobado con observaciones** (APPROVE_PHASE, 0 BLOCK). Solo Chromium 153, Node 24.22.1. El harness (`harness.html`, servido por Vite solo en pruebas) no forma parte de `dist/preview.html`.

## Decisiones del dueño durante la fase

- **D11:** NumberField de Base UI 1.9.0 rechazado. Descarta «abc» al escribir y con `es-CL` convierte «1.5» en 15 y «1441» en «1.441». Se usa TemporalField (Field + texto validado con la regla v5). Sonda archivada en `evidence/1B/numberfield-probe-output.txt`.
- **D12:** Sonner retirado. Su contenedor fija `aria-live="polite"` sin opción pública y su Escape no cierra el aviso enfocado. Se usa una pila propia portada de `toasts.mjs` (regiones `#live`/`#live-error`, sin expulsión, suspensión modal, foco siguiente/anterior/respaldo, Escape y Alt+T dentro de la pila).

## Gates repetidos por el revisor desde `npm ci`

| Gate | Resultado |
|---|---|
| audit-total / audit-runtime | 0 hallazgos, código 0; Sonner ausente de manifiesto, lock, código y `node_modules` |
| typecheck, lint | PASS |
| unit / component | 3/3 y 48/48 |
| build | PASS; `dist/preview.html` SHA256 `7771a12a42cf510e4feb4e29d1dcd542820c84a553e8fd44e101efe468dab892` (cambia frente a 1A por el arranque extraído; suite offline-theme sin cambios de aserción) |
| check:portable / measure:bundle | PASS / 1,009 × v5 |
| e2e completo | 16/16 en 3 corridas; incluye foco real Drawer → Dialog, inert bajo modal, Tab fuera del Popover, Alt+T y Escape en la pila |

Observación 1 de 1A cerrada: `startApp` en `src/app/bootstrap.tsx` y `tests/component/bootstrap.test.tsx`; las mutaciones de sorteo en render, sesión dentro del árbol, sin StrictMode y sin script de tema fallan. Mutaciones del revisor: 20 detectadas, 4 sobreviven (ver abajo).

## Condiciones de entrada para fases siguientes (WARN de la revisión)

Para 3A (estructura y navegación):
1. El coordinador es dueño del estado de capas pero no de Escape ni de Atrás (hoy resueltos por Base UI); `closeTop` solo se usa en pruebas del reductor. Cablear Escape/Atrás al coordinador.
2. `resolveReturnFocus` comprueba conexión e `inert`, no visibilidad; la mutación que ignora `inert` sobrevive.
3. Docking real: en el harness el campo no cambia de contenedor al cruzar umbrales; probar el layout real con un solo nodo.
4. Selección, caret, undo y texto crudo tras cerrar/reabrir panel y cambiar tema: sin prueba (el sondeo del revisor en Chromium los vio conservados).
5. «Un solo root» solo cuenta `#root` en el HTML; el e2e usa el atributo privado `[data-base-ui-inert]`.
6. Cierre repetido durante animación probado sin animación.

Para 5A (avisos):
1. `clear()` deja el último texto en la región viva; v5 la vacía.
2. `store.dismiss(id,'keyboard')` ignora la modalidad y `clear()` no restaura el foco como v5; el foco solo se gestiona en la ruta de clic/Escape del componente.
3. Alt+T no respeta `defaultPrevented` ni `isComposing`, ni la suspensión.
4. TemporalField acepta `trim()` sin que una prueba lo detecte (pasa a 4A); una fuga de suscripción al store no es contada.
5. Sin portar aún: animación, scroll de lectura, botón «Limpiar» con contador, `aria-hidden` al suspender.

No verificado: lector de pantalla, IME, Firefox, WebKit, táctil y gestos del Drawer, animaciones, Atrás sobre capas, Tabs, Collapsible, Checkbox, Select, AlertDialog, host/iframe y `check:parity` (el script no existe).
