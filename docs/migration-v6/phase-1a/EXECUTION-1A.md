# Ejecución de la fase 1A · shell offline y tema de sesión

Fecha: 08/11/2026. Encargo: [BRIEF-1A](BRIEF-1A.md). Roles: implementador Claude Haiku, orquestador Claude (diagnóstico de primer paint y cierre), revisor independiente Claude Sonnet. Producto: `prototypes/frontend-v6/`. Registro detallado: `prototypes/frontend-v6/evidence/1A/LOG.md`; revisión: `prototypes/frontend-v6/evidence/1A/review/REVIEW-1A.md`.

**Resultado: G1A aprobado con observaciones** (revisión APPROVE_PHASE, 0 BLOCK, 4 WARN). Verificado solo en Chromium 153 (Playwright, headless) con Node 24.22.1 y npm 11.19.1.

## Gates repetidos por el revisor desde `npm ci`

| Gate | Resultado |
|---|---|
| audit-total / audit-runtime | PASS, 0 hallazgos y código 0 en ambos (D10: oxlint en lugar de ESLint) |
| typecheck, lint | PASS |
| unit / component | 3/3 y 12/12; RED previo por aserción registrado por el implementador |
| build | PASS; `dist/preview.html` SHA256 `074ca0a017326a8377ffbb0eb186ae4b97adc07fb3ce8ed276243fdb80515cc4`, idéntico al del implementador |
| check:portable | PASS: 0 peticiones externas, 0 errores, fuentes cargadas; control negativo con imagen externa: código 1 |
| measure:bundle | 1.095.561 bytes (gzip 725.861), 1,009 × v5; sin aviso |
| offline-theme (file:// y HTTP local) | 5/5 en 3 corridas; primer paint 12/12 adicionales |
| Arranque del shell (informativo) | v6 p50 125 ms / p95 146 ms; v5 p50 375 ms / p95 387 ms (20 muestras) |

Requisitos cerrados: HOME-SUBTITLE-01/02/03, DESIGN-COMPLETE-01/02, TOKENS-01 y UI-01. Tokens, fuentes, icono usado y licencias idénticos a v5 (sha256). Mutaciones detectadas: 10 de 13; ver revisión.

## Primer paint

El implementador vio frames blancos en 2/10 corridas partiendo de `about:blank`. El orquestador cambió el oráculo para partir de un documento oscuro neutral y exigir que todos los frames sean oscuros (50/50 sobre el mismo hash). El revisor está de acuerdo con reservas: el oráculo sigue detectando un destello real (quitar el script de tema da frame blanco 5/5), pero no reprodujo el blanco con `about:blank` (0/30), así que la causa propuesta no está demostrada. No cubre pestaña real ni iframe de host.

## Observaciones abiertas

1. EXTRA-STRICTMODE-HOME probado en parte: ninguna prueba ejecuta `main.tsx`; mover `createSession` dentro de `StrictMode` o quitar `StrictMode` no hace fallar nada. Cerrar al inicio de 1B con una prueba del bootstrap real.
2. EXTRA-OFFLINE-FIRST-PAINT depende solo de la prueba de capturas.
3. Cambio del oráculo de primer paint posterior a un resultado discrepante (ver arriba).
4. `check:parity` apunta a un script que aún no existe (se crea con la matriz de v6).

No verificado: Firefox, WebKit, dispositivos reales, lectores de pantalla, host/iframe, revisión visual en píxeles, StrictMode en `vite dev` y las 205 filas restantes de la matriz.
