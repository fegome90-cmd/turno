# Tabla de dueños de estado · Fase 2A (EXTRA-STATE-AUTHORITY)

Verificada contra `src/app/store.ts`, `src/app/create-session.ts`, `src/adapters/preview-adapter.ts` y `src/notifications/notification-store.ts` (revisión del código, no solo de la existencia de la tabla).

| Estado | Dueño (escribe) | Quién lee | Cuándo cambia | Prueba que lo demuestra |
|---|---|---|---|---|
| Datos del turno (fuente) | Adaptador `createPreviewAdapter` (memoria de la instancia) | Store (solo mediante `load` y respuestas) | Solo en las operaciones `TurnoPort` aceptadas | PREVIEW-02, PREVIEW-05..07, EXTRA-STATE-AUTHORITY (conflicto) |
| `snapshot` (copia confirmada) | Store de sesión `createTurnoStore` | UI (futura) y pruebas | Solo tras respuesta exitosa (`persist` → `apply`); sin optimistic updates | EXTRA-STATE-AUTHORITY «sin actualización optimista», «guardado exitoso», «fallo», «conflicto» |
| `selection` y ruta de UI | Store (`select`) | UI (futura) y borrador | Solo `select` | «respuesta tardía de una selección anterior» |
| `draft` (título y cuerpo crudos) | Store (`setDraftField`, `select`, respuesta exitosa de la misma entidad sin ediciones nuevas) | Editor (futuro) | Por edición del usuario o por reinicio tras guardar la misma selección | «fallo» (texto conservado), «conflicto» (no pisado), «respuesta tardía» (B intacto) |
| `temporal` (fecha, hora, estimación, realizada, duración, crudos) | Store (`setTemporalField`, `select`, respuesta exitosa) | Editor (futuro) | Igual que `draft` | DRAFT-01..03; EXTRA-STATE-AUTHORITY «fallo» |
| `errors` | Store (`saveTask`/`saveNote` por validación; `select` lo vacía) | Editor (futuro) | Validación previa a la mutación; selección | «validación antes de mutar», «respuesta tardía» (errores de B intactos) |
| `busy` | Store (`persist`) | Acciones | Inicio y fin de cada mutación | «una sola mutación por acción», «sin optimistic» |
| Avisos (`items`, `announcement`, suspensión) | notification-store (D12) | Pila de avisos (`NotificationStack`) | Solo `notify`, `dismiss`, `setSuspended`, `clear` | Pruebas 1B y D12 |
| `noticeCount` | notification-store; el store solo lo refleja con `setState` en la suscripción | UI (futura) | Cada cambio del notification-store | EXTRA-LIFECYCLE-ASYNC (suscripción vuelve a cero) |
| Suscripción al notification-store | `createTurnoStore` (una por store) | — | Creación; se libera en `dispose` (idempotente) | 20 ciclos de `createSession` y del store |
| Sorteo del subtítulo | `createSession` (una llamada a `random`) | Home | Una vez por sesión | `random` llamado una sola vez; EXTRA-LIFECYCLE-ASYNC |

Reglas comprobadas:
- Una mutación por acción: `persist` ignora una segunda llamada mientras `busy` es verdadero (una llamada al adaptador).
- Fallo, conflicto o respuesta tardía con fallo: el snapshot no cambia; el borrador y los errores de la selección actual no cambian; se publica un aviso de error en el notification-store.
- Respuesta tardía con éxito de una selección anterior: actualiza solo su copia confirmada; el borrador de la selección actual no cambia (`revision` y `selection.id` lo comprueban).
- Red y almacenamiento: cero llamadas a `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage` e `indexedDB` en carga, edición, guardado y cierre (`installNetworkAndStorageSpies`).
- Dos instancias del adaptador no comparten estado (PREVIEW-02).

Límites conocidos (no verificados en 2A):
- La UI no está conectada al store; `startApp` sigue con datos estáticos (decisión del brief).
- No hay persistencia real ni sincronización con backend; no aplica en esta demo.
