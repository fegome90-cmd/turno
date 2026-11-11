# Turno 2B: QA final en MacBook Air

Fecha: 2026-11-09 (UTC). **PASS técnico del harness y sus regresiones en Chromium.** La aceptación de fase y el cierre integrado quedan fuera de esta verificación.

## Resultado final
- Historial focalizado file/HTTP: **24/24 PASS**.
- Suite E2E completa: **40/40 × 3**, sin omisiones, retries ni casos flaky. Cada corrida incluye los 24 de historial y 16 de regresión.
- Unit: **105/105**. Componentes: **57/57**.
- Typecheck, lint, build y portabilidad estática/runtime: PASS.
- Auditorías total y runtime: **0 vulnerabilidades**, exit 0.
- Portabilidad del producto: cero solicitudes externas, errores de consola o errores de página.
- 577 archivos fuente verificados contra el git archive después de las pruebas: **cero diferencias**.

## Entorno y procedencia
- Commit exacto: 72459f5ffc3c48db4202792208370b4ca92d5426.
- Paquete fuente SHA256: c96303ef391a6d0308ca6098d4d8a40d0a85f550229a47919aa823d94e2ee72e.
- Equipo: MacBook-Air-de-Felipe.local; macOS 26.2 (25C5048a), arm64.
- Node 24.22.1 oficial, checksum validado contra SHASUMS256.txt de nodejs.org; npm 11.19.1.
- Google Chrome 156.0.8078.80 ya instalado; Playwright 1.65.0, un worker, retries 0.
- Instalación de dependencias limpia desde lock con npm ci --ignore-scripts --no-audit --no-fund. Node y caché npm permanecen en carpeta aislada; sin cambios de configuración global ni checkout del usuario.

## Correcciones verificadas
1. La allowlist de red permite el HTML local exacto y el servidor HTTP correspondiente. Los controles negativos interceptan y abortan la solicitud de prueba externa sin hacer red real.
2. El popstate tardío ya no sobreescribe la selección nueva ni el borrador durante un replay aprobado o una navegación del usuario pendiente.
3. La navegación aprobada espera el cierre completo del diálogo. El borrador nuevo mantiene foco antes y después de resolver una respuesta antigua. Se conserva el oráculo de foco, sin sleeps, sin aumentar timeouts y sin eliminar escenarios.

Los candidatos previos se conservaron como evidencia: 4f88fca abortaba los 11 casos file en el interceptor del test; 4234a8e dio 38/40 en tres corridas por una carrera de foco al desmontar el diálogo. Este reporte sólo declara PASS sobre 72459f5.

## Identidad de artefactos
- package.json: bc79b9b319d409d7cefeef981f52c8ef0a1ab2daf10de7cc737fc1b114936cb2.
- package-lock.json: 63673cd3cc34ecfea5d4c92a30c42388fe79644d08d6637f04c070dfd8d79280.
- Producto dist/preview.html: ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343, idéntico a los candidatos anteriores.
- Harness dist-history/history-harness.html: f9826fc0ccebc962205870161229e5b9b46aee6e9e51873052516918ac585bb4.

## Adaptación de ejecución
El repositorio fija un ejecutable Linux en /opt/pw-browsers/chromium. En Mac se usaron configuración y copia del chequeo de portabilidad externas al árbol fuente para seleccionar Chrome instalado y ubicar logs. No se alteraron los escenarios, timeouts, fuentes, dependencias ni scripts originales. Las copias de QA están incluidas en qa-adapters/.

## Cobertura y límites
Las suites ejercitan Atrás/Adelante reales, foco de Chromium, error/reintento, cancelación y descarte, guardado y respuestas antiguas, overlays/busy, entradas ajenas, tema/offline, primer paint oscuro, teclado, primitivas y conservación de campos en los umbrales del harness.

No se acredita inspección visual manual independiente: la conexión UI nativa no estuvo disponible. Tampoco se acredita VoiceOver, otros motores, dispositivos reales distintos del Air, accesibilidad integral ni sandbox del host ChatGPT. HISTORY-01–09 continúan sujetos a integración posterior. No se publicaron, fusionaron ni desplegaron cambios; no se registró aceptación humana.

Este paquete contiene informe, logs textuales, resultados JSON y adaptadores de QA. No incluye capturas ni trazas visuales.
