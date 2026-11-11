# Corrección posterior de carreras de historial 2B

Fecha: 09/11/2026. Base: `fd777bfb1656dc55114e170e14474ba5ee70c481`. Este registro añade una revisión posterior; no convierte las pruebas históricas en pruebas de la fuente corregida.

## Defectos reproducidos y corrección

1. Back aprobado, replay retenido y Forward opuesto dejaban un replay pendiente aunque el navegador ya hubiera vuelto al origen. La siguiente navegación quedaba encolada indefinidamente. Llegar al origen visible ahora liquida ese replay y conserva la intención nueva, si existe.
2. Una edición nueva entre la aprobación y el movimiento/entrega del replay podía desaparecer. `cancelPending()` revoca la decisión anterior, incluida una travesía ya en vuelo. El controlador vuelve al origen antes de aplicar ninguna ruta y no crea entradas de compensación.
3. Dos `push()` en un evento React consultaban callbacks del render anterior. TASK→HOME perdía HOME y TASK→TASK duplicaba entradas. El hook mantiene una proyección por valores durante el batch y la reconcilia en el layout del siguiente commit. Solicita su propio commit incluso cuando un normalizador conserva la identidad del estado del consumidor. No exige identidad estable de `readRoute`, no cambia la firma de `applyRoute` ni fuerza `flushSync`.

## Contrato de integración para 4A/4B

- El consumidor conserva la autoridad sobre selección y borrador; el controlador conserva índices y segmento propio. El hook conserva callbacks del render confirmado.
- **Toda edición nueva**, incluido título, cuerpo y los futuros campos temporales, debe llamar sincrónicamente a `controller.cancelPending()` en su manejador antes de actualizar el borrador. Una decisión de guardar/descartar sólo cubre la revisión que el usuario aprobó. Las operaciones de guardado siguen comprobando generación y revisión propias.
- `cancelPending()` es idempotente, no navega a otra ruta visible, no hace push, no cambia el título y es inocuo tras dispose. Puede compensar un movimiento del navegador para conservar el origen y Forward.
- Un consumidor que normalice selección puede continuar usando `applyRoute(): void` y un setter React normal. Su ruta confirmada, no la proyección solicitada, determina título y deduplicación después del commit.
- Una intención nueva o un unmount invalida respuestas antiguas. El cierre completo del modal sigue precediendo al resume, sin omitir la limpieza del dueño de foco.

El harness llama a `cancelPending()` tanto en título como en cuerpo. Estos manejadores son referencias técnicas, no una integración acreditada de los editores futuros.

## Evidencia y cobertura

TDD: seis fallos iniciales contra fd777bf (replay opuesto en ambos sentidos, batching en dos variantes y edición tras guardar/descartar), cuatro fallos de la API de cancelación aún ausente y tres fallos posteriores de revisión (lectura por copia y normalizador sin commit). Se conservaron RED y GREEN por separado. Una aserción nueva de título se corrigió porque el getter DOM normaliza espacios; el valor literal con espacios se sigue comprobando en el campo.

El caso de normalización sin commit pasaba en fd777bf y fallaba en el primer candidato: fue una regresión introducida durante el fix y corregida antes del snapshot final.

Las regresiones versionadas incluyen cancelación antes de resume y después del movimiento en ambos sentidos; edición de título/cuerpo después de guardar/descartar antes del movimiento o de la entrega; reanudación antigua inerte; preservación de Forward; continuidad de la navegación; StrictMode/20 ciclos; batching con lecturas por referencia y por copia; selección normalizada y callbacks de título actualizados.

Se añadieron veinte escenarios de navegador file/HTTP, con movimientos reales y entrega retenida del adaptador: replay opuesto ± y título/cuerpo × guardar/descartar × ±. La suite enumera 44 escenarios de historial y 60 E2E totales, con retries 0. **Enumerarlos no equivale a ejecutarlos.**

## Estado del gate

**Actualización posterior, 09/11/2026:** el bloqueo de ejecución que se describe abajo es histórico de la nube de implementación. La auditoría independiente del snapshot final y la verificación Chromium Mac `76943e5` ya están disponibles: 111/111 unit, 81/81 componentes y 60/60 E2E, portabilidad real file:// PASS. Véanse [estado y gates vigentes](../../../docs/migration-v6/STATUS-2B.md), [informe Mac](../evidence/2B/mac-76943e5/INFORME.md) y [auditoría independiente](../evidence/2B/independent-76943e5/INDEPENDENT-AUDIT-2B-FIX.md). La nube Codex del usuario no se ejecutó; no se afirma equivalencia Linux ni cierre formal. Los resultados crudos previos se conservan.

La corrección requiere auditoría independiente del snapshot final y pruebas posteriores en la nube Codex del usuario antes de cerrar el gate. En la nube de implementación Chromium no pudo arrancar: `socket() failed: Operation not permitted`, antes de abrir una página, también al solicitar ejecución ampliada. No se presenta como PASS ni como fallo funcional de los escenarios. El adaptador QA sólo seleccionó `/usr/bin/chromium`, sin modificar escenarios, timeouts ni reintentos.

No se ejecuta ni se declara APPROVE_PHASE en este cambio. No hay merge ni despliegue. HISTORY sigue planned para 4A/4B; tampoco se certifican host ChatGPT, lector de pantalla, IME real, Firefox/WebKit, otros dispositivos ni revisión visual humana.
