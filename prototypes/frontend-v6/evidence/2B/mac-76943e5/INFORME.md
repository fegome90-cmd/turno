# Turno 2B · Verificación Mac del candidato 76943e5

Fecha: 9 de noviembre de 2026. Máquina: MacBook-Pro-de-Felipe-8.local (Apple Silicon).

## Resultado

PASS en Chromium: **60/60 E2E**, sin fallos, omitidos, flaky ni reintentos. Incluye **44/44 de historial** (22 file:// y 22 HTTP local) y **26/26 file://** (22 de historial y cuatro de tema/offline). Son subconjuntos de los 60, no pruebas adicionales.

`check:portable` ejecutado con adaptador de ruta Mac: **PASS**, cero solicitudes externas, errores de consola/página y fallos estáticos. El HTML se abrió realmente por file:// y cargó las fuentes locales.

También pasan 111/111 unitarios, 81/81 componentes, typecheck, lint, build del producto y build del harness. La suite completa duró 39.6 segundos.

## Identidad e integridad

- Commit: `76943e5db6cf203e8f2738391f4318523c63ad7b`.
- Árbol Git: `f70a1a19b28d5dd2cedae789d07c1568ed4dc2ab`.
- Snapshot original: `Turno_2B_correccion_76943e5_bundle_pruebas_auditoria.zip`.
- Manifiesto SHA256 original verificado por completo.
- 718 archivos comprobados antes y después, sin modificaciones; working tree limpio.
- El bundle es incremental: no se reconstruyó la historia padre. Se recuperó el objeto del commit candidato y se verificó su árbol completo contra los archivos del snapshot.

## Entorno y adaptación

Node 24.22.1 y npm 11.19.1 aislados en la carpeta de trabajo. Descarga oficial con SHA256 verificado. `npm ci --ignore-scripts --no-audit --no-fund` con el lockfile sin cambios; no se cambiaron instalaciones globales.

Google Chrome for Testing 156.0.8078.4, revisión de caché Playwright 1248, ya instalado. No se usó el perfil personal del navegador.

Los adaptadores externos sólo resuelven la ruta del navegador y rutas de ejecución/salida. La portabilidad cambia una línea (`executablePath`). La configuración E2E importa la original y conserva escenarios, controles de solicitudes, timeouts, workers 1, retries 0 y webServer. Añade salida JSON para evidencia. No se modificó la fuente del candidato.

Los bloqueos iniciales de descarga quedaron resueltos después de la autorización explícita. La consulta de procesos fue rechazada por macOS y no se reintentó.

## Alcance y límites

Esta evidencia resuelve los casos browser pendientes de este candidato en este Mac. No certifica Firefox/WebKit, otro sistema operativo, IME real, lector de pantalla, revisión visual independiente, editores integrados 4A/4B ni host ChatGPT real. No convierte HISTORY en integración de producto ni concede APPROVE_PHASE. No se repitieron npm audit ni check:parity.

Sin push, merge, publicación o despliegue. Los proyectos existentes permanecieron intactos.

## Contenido

`logs/` incluye salidas completas, reporte E2E JSON, listado de 60 casos ejecutados, manifiestos de fuente y resumen estructurado. `qa/` contiene los dos adaptadores usados. Las capturas automáticas de pruebas no se incluyen.
