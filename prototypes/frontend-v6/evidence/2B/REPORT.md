# 2B · Candidato 72459f5, sin aprobación de fase

**Evidencia técnica final PASS:** Mac y revisión independiente sobre 72459f5 completos. La aprobación de fase queda sujeta al checker y la revisión de la consolidación documental; no se promueven requisitos HISTORY ni se avanza automáticamente a 3A.

- Base: `e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b`.
- HEAD local: `72459f5ffc3c48db4202792208370b4ca92d5426`.
- Rama: `work/phase2b-indexed-history`, clon aislado. Fuente comprometida; evidencia aún sin commit mientras las puertas siguen abiertas.
- Sin push, PR, merge ni despliegue. Sin cambios a v5, backend, autenticación, plugin, manifiestos de despliegue, package.json ni lock.

## Entregable y autoridades

El controlador inyectable posee índices, compensaciones e intenciones de historial, no borradores ni overlays. El consumidor aplica selección/ruta y conserva el borrador. La guarda decide busy, overlays y dirty. El hook mantiene las callbacks del último render confirmado y una suscripción con cleanup. `readRoute()` debe reflejar `applyRoute()`; `push(rutaActual)` invalida decisiones pendientes sin crear entrada.

Inicializa con replace, sin push ni URL nueva. Navegar a una ruta distinta crea una entrada. Back/Forward usa go(delta), sin push compensatorio que destruya Forward. Una reanudación aprobada conserva dirección y ocurre una vez; una intención posterior o dispose invalida callbacks antiguos. Un evento obsoleto que no coincide con History.state no puede aplicar una ruta vieja.

Las entradas externas no se reemplazan ni se fuerza su navegación. Tras cruzar un límite sin índices fiables se crea otro segmento propio. El marcador no es un límite de seguridad. No se certifica navegación exterior, cierre de pestaña ni historial del host.

El harness técnico es un HTML separado, con OverlayProvider/Dialog reales y guardado sintético de resultado explícito. No interpreta resolver `store.saveTask(): Promise<void>` como éxito. No simula TaskEditor/Agenda/archivo como integración de producto. HISTORY-01–05/07–09 esperan 4A y HISTORY-06 espera 4B. EXTRA-LIFECYCLE-ASYNC se evalúa aquí sólo en este alcance técnico.

## Estado verificado no visual

Cloud Linux, Node 24.22.1, npm 11.9.0. Registry npm público. Logs con zona del proceso America/Santiago; las fechas de contexto se guardan en UTC. Concurrencia 1.

- Unit: **PASS 105/105**, 8 archivos, `final-unit.log` y JSON nativo.
- Componentes: **PASS 57/57**, 7 archivos, `final-component.log` y JSON nativo.
- Typecheck y lint: **PASS**, código 0.
- Build producto y build separado del harness: **PASS**, código 0.
- Descubrimiento Playwright: **24 casos**, 12 file y 12 HTTP. No equivale a ejecución.
- Auditorías total/runtime: últimos JSON válidos con cero vulnerabilidades, sobre manifest/lock idénticos a los actuales. Su procedencia anterior a los últimos cambios sin dependencias queda explícita en el contrato; no se atribuyen a invocaciones nuevas. QA Mac también obtuvo cero sobre 4234a8e con esos mismos inputs.
- `git diff --check`: PASS.

Artefactos actuales:

- Producto `dist/preview.html`: `ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343`, idéntico a 2A.
- Harness `dist-history/history-harness.html`: `f9826fc0ccebc962205870161229e5b9b46aee6e9e51873052516918ac585bb4`.
- `artifact-sizes.json` registra bytes/gzip con Node gzipSync, sin conclusión de rendimiento comparado.

El script opcional measure:bundle está BLOCKED porque falta el artefacto generado v5/preview.html en el clon. No se modificó v5 para fabricarlo. El gate requerido de Chromium se verificó en Mac, separado de esta medición.

## RED y correcciones

1. Controlador: 15 fallos funcionales antes de implementar (`red-controller.log`). Hook: ausencia de listener antes de conectar efectos (`red-hook.log`). Se cubren 20 ciclos y StrictMode.
2. Entradas externas/reattach y click a la misma ruta durante compensación: RED separados, luego GREEN. No se reutilizan índices incompatibles ni se destruye Forward.
3. Revisión independiente encontró popstate tardío pisando una intención nueva. Cinco regresiones RED de replay/push y pop pendiente/push; fix 7b6d3e9, controlador 25/25. El revisor repitió sus dos repros y gates no visuales.
4. Cancelar mientras se guarda: RED conservado; un resultado posterior no reanuda ni borra la nueva edición.
5. Interceptor de pruebas file: Mac 4f88fca dio 11 HTTP PASS y 11 file FAIL antes de cargar app. El test abortaba su propio documento. Fix 4234a8e: URL file exacta y HTTP del origen del servidor. Policy RED 2, luego GREEN. Otros archivos/puertos/hosts y terceros siguen bloqueados; controles negativos exigen abortar una solicitud intencional a .invalid, sin debilitar los demás escenarios.
6. Revisión del helper detectó blob con origen HTTP heredado. RED del mismo origen en `red-same-origin-blob-policy.log`, fix dba92f9 exige protocolo HTTP del request. GREEN 6/6.
7. Mac 4234a8e reprodujo pérdida de foco: 22/24 focal y 38/40 de suite completa, repetido tres veces. La traza pasiva demuestra que sucedía antes del resolver viejo: ruta task-2 editable mientras el Dialog cerrado seguía montado; su rAF llevaba foco del textarea al popup y después a BODY. Las lecturas activas que hicieron pasar 2/2 alteraban el timing y no se contabilizan como verde.
8. Fix 72459f5: la guarda difiere resume hasta la API pública Base UI `onOpenChangeComplete(false)` y una microtask posterior al cleanup. Bloquea navegación durante ese cierre. No usa sleeps ni amplía timeouts. Nuevo RED componente reproduce la rama asíncrona de Base UI mediante getAnimations; GREEN tras el fix. Esto es evidencia simulada, no foco de navegador. El E2E mantiene el oráculo posterior al resolver y agrega otro antes de resolver.

Los fallos iniciales de typecheck/build por tipos de tests se conservaron como iteración, no como RED funcional. Los casos finales no tienen skip ni expectativas reducidas.

## Chromium y revisión pendientes

Cloud: arranque previamente bloqueado por socket(), incluso en el diagnóstico escalado del revisor. No se relanzó por otra ruta para evitar esa restricción. No se sustituye por jsdom.

Mac Air autorizado: QA recibió la fuente exacta 72459f5 por Space v3, archivo turno-2b-candidate.tar.gz, SHA256 `c96303ef391a6d0308ca6098d4d8a40d0a85f550229a47919aa823d94e2ee72e`. Resultado final: 24/24 focal y 40/40 completos en tres corridas, sin omisiones, retries ni flaky. Logs y JSON originales, adaptadores externos e integridad de 577 archivos están en mac-final-72459f5/. Los bytes se compararon también contra los blobs Git de ese commit; cero diferencias.

Revisión independiente: runtime del controlador 7b6d3e9 aprobado en alcance no visual; suplementos de tests cotejados. El nuevo cambio de coordinación de cierre 72459f5 recibió PASS independiente no visual, incluyendo cinco pruebas adicionales de cierre suspendido. El informe está adjunto; la implementación no se aprueba a sí misma. La revisión final documental y de contrato se registra aparte.

Firefox/WebKit, dispositivo táctil, lector de pantalla, IME real, integración de producto y host ChatGPT: NOT RUN / fuera del alcance de 2B. No se deducen de tests automáticos o capturas.

## Auditorías y guía de diseño

Un intento final audit-total fue denegado por envío de metadatos a npm sin autorización visible. Se conservó el archivo vacío y stderr, sin contarlo como auditoría. El orquestador aportó evidencia nueva del alcance autorizado del plan; se reintentó una vez la operación denegada y terminó aceptada, código 0 y cero vulnerabilidades. No se cambió registro ni ruta. Los cambios posteriores no tocaron dependencias; el reporte conserva los SHA y tiempos de las observaciones previas.

Design Skills Router 0.2.1 se usó como guía acotada. El expediente histórico 0.1 quedó intacto; el runner actual informó schema mismatch. No se fabricó una migración, recibo o aprobación de diseño. Véase router-guidance.md. Las referencias no se confunden con autoridad ni con verificación visual.

Decisiones conservadas: harness separado para no fingir producto integrado; segmentos nuevos ante índices externos desconocidos para no inventar desplazamientos. Costes y límites se registran en progress.md.

## Reconciliación de cierre

La copia de ejecución docs/parity-map.json conserva 212 identidades: 30 verified no visuales de 2A y 182 planned. Los 47 targetCases de 2A se contrastaron con JSON ejecutado, sin marcadores. Se corrigieron el título de VALIDATION-01 y el conteo de mutaciones: 34 más N32=35/35. Informes históricos e013 y los gates nuevos 72459f5 están separados por procedencia; no se relabelan corridas. La evidencia Mac final pertenece a 72459f5 y los commits de consolidación posteriores no alteran fuente ejecutable, tests, lock ni HTML.
