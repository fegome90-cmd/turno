# Ejecución técnica de 2B

**Revisión posterior:** los resultados de este registro son históricos de `72459f5`. La corrección `76943e5` y su contrato están en [REPLAY-RACE-FIX-2B.md](REPLAY-RACE-FIX-2B.md). La [consolidación vigente](../../../docs/migration-v6/STATUS-2B.md) registra auditoría independiente y 60/60 E2E reales en Chromium Mac del candidato corregido. No se heredan los conteos antiguos ni se declara APPROVE_PHASE.

Fecha: 09/11/2026. Fuente ejecutada final: `72459f5ffc3c48db4202792208370b4ca92d5426`, base `e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b`. El cierre se limita al controlador/hook y su harness. El producto Home no se conecta todavía a navegación de workspace.

## Contrato implementado

Inicialización replace sin push; una entrada por ruta distinta; URL sin cambios; idx y segmento propio; Back/Forward y saltos con go(delta). Busy y overlays compensan sin push que destruya Forward. La guarda permite bloquear, pedir decisión o reanudar una vez en la dirección original. Nueva intención o dispose invalida callbacks antiguos. Los eventos que ya no coinciden con History.state no pisan una selección reciente.

Los índices pertenecen al controlador; la selección/borrador al consumidor; las capas al coordinador. El hook conecta una suscripción y callbacks del render confirmado. Entradas externas no indexadas se respetan; después de cruzarlas no se inventan deltas para el segmento anterior. No se certifica historial exterior ni del host.

El harness usa resultado explícito de guardado y conserva borrador ante fallo/cancelación. Navegación aprobada espera el cierre completo de Dialog mediante onOpenChangeComplete(false) y cleanup, para no presentar un editor bajo una trampa de foco todavía activa.

## Correcciones conservadas

- Popstate viejo durante replay/push y pop pendiente/push: RED, cinco regresiones y fix 7b6d3e9; dos repros independientes repetidos.
- Interceptor file de pruebas: 4f88fca abortaba su propio documento local. Fix 4234a8e sólo permite el file exacto o HTTP del servidor de ese caso; los controles negativos confirman abort de terceros. Un blob de origen heredado quedó excluido explícitamente en dba92f9.
- Foco durante cierre: 4234a8e falló de forma reproducible en Mac (38/40 ×3). La traza pasiva ubicó el robo de foco antes de la respuesta vieja. Fix 72459f5 espera la liberación del dueño modal. Se mantuvo el oráculo posterior al resolver y se añadió otro antes de resolver; sin sleeps ni timeouts mayores.

Las pruebas de las versiones fallidas y los diagnósticos se conservaron; no se eligió una repetición verde del mismo código para ocultar el problema.

## Verificación final

MacBook Air, macOS 26.2 arm64, Node 24.22.1, npm 11.19.1, Chrome 156.0.8078.80 y Playwright 1.65.0, un worker, retries 0. Instalación desde lock en carpeta aislada. La configuración de QA externa sólo selecciona Chrome y rutas de salida; no modifica escenario, fuente, timeout ni dependencia.

- 105 unit y 57 componentes PASS; typecheck/lint/build PASS.
- Historial focalizado file/HTTP: 24/24 PASS.
- Suite completa: 40/40 ×3 PASS, cero skipped/retries/flaky; incluye 24 de historial y 16 regresiones de shell/primitivas.
- Portabilidad del producto PASS: cero red externa y errores de consola/página.
- Auditorías total/runtime: cero vulnerabilidades.
- 577 archivos fuente contra el git archive de 72459f5: cero diferencias antes/después. El manifiesto SHA256 no se llama Git tree; se verificaron sus bytes contra los blobs del árbol `a4a7fe3c5b06f1ac4abcd5d9a7dd6435c73f458e`.
- Producto: `ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343`.
- Harness: `f9826fc0ccebc962205870161229e5b9b46aee6e9e51873052516918ac585bb4`.

La revisión independiente repitió los gates no visuales y añadió cinco pruebas de cierre suspendido: guardar/descartar esperan el cierre; Volver, intención nueva y unmount invalidan navegación diferida. No quedó bloqueante funcional confirmado en ese corte. La consolidación documental requiere la revisión final y el checker sobre su snapshot efectivo.

## Alcance del cierre

EXTRA-LIFECYCLE-ASYNC se acredita técnicamente en unit/component y Chromium del harness. Las 10 filas HISTORY siguen planned: 01–05/07–10 esperan 4A y 06 espera 4B. Ningún resultado del harness cierra interfaz futura, host ChatGPT o todos los requisitos de accesibilidad.

No se acredita revisión visual manual independiente, lector de pantalla, IME real, Firefox/WebKit ni otros dispositivos. El router de diseño se usó como guía y no se fabricó aceptación de su expediente histórico. Estos documentos no constituyen aceptación humana ni autorización para merge o despliegue.
