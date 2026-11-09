# Auditoría independiente del cierre 2A

## Resultado

**PASS técnico de las correcciones W1–W6 y S3. Cierre formal de G2A incompleto.** No encontré un defecto funcional bloqueante en los cambios de e0133a4. Las nuevas pruebas detectan las mutaciones que antes sobrevivían. No se modificó código de producto ni el checkout del implementador 2B.

El contrato del repositorio sigue sin tener un informe estructurado de ejecución 2A validado por contract_gate.py, y la matriz mantiene las 30 filas 2A como planned con targetCases de marcador. Son pendientes de trazabilidad del orquestador, no evidencia de fallo del dominio. No corresponde emitir APPROVE_PHASE formal hasta reconciliarlos o registrar expresamente una enmienda autorizada al método.

## Corte y alcance

- Repositorio: fegome90-cmd/turno.
- Rama remota verificada dos veces: claude/confident-galileo-rahzv6.
- HEAD: e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b.
- Árbol: da5d118a4f26bcec7688b5afc85bd492839fa117.
- Padre: 139f3d836504f15663eb3c657f0d6da26fa7a2c4.
- e0133a4 cambia 17 archivos de tests, evidencia y documentación; no cambia src, package.json ni package-lock.json.
- Checkout independiente: /workspace/scratch/ae7ea9e7b2f5/turno-2a-verified. Estado Git limpio al finalizar.
- Mutaciones ejecutadas exclusivamente en /workspace/scratch/ae7ea9e7b2f5/turno-2a-mutants; src restaurado y comparado byte a byte.
- Node v24.22.1, npm 11.9.0. Contexto y hashes: context.json.

## Verificación nueva

| Comando / control | Resultado | Evidencia |
|---|---|---|
| npm ci --ignore-scripts, caché escribible local | PASS, 127 paquetes | npm-ci-retry.log |
| npm run test:unit | PASS, 74/74 en 6 archivos | test-unit.log |
| npm run test:component | PASS, 52/52 en 5 archivos | test-component.log |
| npm run typecheck | PASS, exit 0 | typecheck.log |
| npm run lint | PASS, exit 0 | lint.log |
| npm run build | PASS, exit 0 | build.log |
| npm audit --include=dev --json | PASS, 0 vulnerabilidades | audit-total.json |
| npm audit --omit=dev --json | PASS, 0 vulnerabilidades | audit-runtime.json |
| measure:bundle, tras generar referencia v5 por su script | PASS de ejecución; informativo, no performance | measure-bundle-after-baseline.log |
| Mutaciones del script histórico del revisor | 34/34 detectadas por pruebas fallidas | mutations-34.log, mutations-34.json |
| N32, quitar session.dispose del bootstrap | Detectada: 1 fallo / 51 PASS, aserción de suscripciones 21 vs 1 | mutation-N32.log |
| Inventario documental | PASS, 212 requisitos / 16 suites fuente | check-docs.json |
| contract_gate sin brief/reporte, solo inventario | PASS solo de inventario, no cierre | contract-inventory.json |
| Nuevo check:portable / E2E browser | BLOCKED por entorno, no PASS | check-portable.audit*.json |

HTML reconstruido: **ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343**, exactamente igual al registrado para 2A.
Tamaño: 1.106.242 B, gzip 729.360 B. Ratio bruto vs v5 1,018; gzip 0,965. No constituye medición de rendimiento.

El primer npm ci falló porque la caché por defecto /home/agent/.npm no era escribible; se resolvió usando una caché local. measure:bundle falló inicialmente porque preview.html de v5 es generado y no versionado; se resolvió con el generador oficial del mismo checkout. Ambos resultados iniciales se conservan.

## Cierre de observaciones

- W1: borrador temporal crudo tras fallo, conflicto y respuestas tardías: pruebas nuevas presentes; N11/N21 detectadas.
- W2: selección limpia temporal y errores: N26/N28 detectadas.
- W3: store conserva espacios crudos y applyTemporalDraft recorta campos aplicados: N30/N31 detectadas. El título contradictorio fue corregido en el test.
- W4: vacío no se transforma en cero: N19 detectada.
- W5: arranque real libera la suscripción de la sesión: N32 detectada en componentes.
- W6: saveNote éxito/fallo/respuestas tardías/validación: N29 detectada.
- S3: adaptador rechaza 24:00 y openShift usa fecha civil de Santiago: N1b/N16 detectadas.

Comparé las transcripciones de dominio/adaptador contra v5: reglas y límites se conservan, además de tipado, extracción de validateTemporal y cambio visible Cama→Lista autorizado por D7. Los 30 IDs asignados a 2A aparecen en los tests ejecutados. Esto es cobertura de requisitos y mutantes dirigidos, no 100 % de líneas/ramas: no hay reporte ni umbral de coverage configurado.

## Hallazgos y consecuencias para 2B

1. **Pendiente formal de cierre.** evidence/2A/LOG.md:130 reconoce que no se produjo el contrato estructurado de auditoría ni se ejecutó su validador. prompts/00-contract.md:45–68 exige metadatos de ambos audits para READY/APPROVE; prompts/30-orchestrator.md exige validar el informe con árbol Git observado. Solo existen JSON de ejemplo 1A, no brief/reporte ejecutado 2A. La matriz conserva 30/30 filas 2A planned y targetCases por crear. El PASS de inventario que repetí no sustituye ese cierre.
2. **Advertencia de integración para guardar y continuar.** src/app/store.ts:60–69 atrapa errores y retorna Promise<void>; saveTask/saveNote también resuelven cuando hay validación fallida o busy. La promesa resuelta no demuestra guardado exitoso. guardNavigation debe reanudar solo con resultado confirmado. Ya informado al implementador 2B.
3. **Advertencia de lifecycle para callbacks de 2B.** src/app/store.ts:229–234 dispose libera su suscripción; no cancela ni invalida persist pendientes. El controlador nuevo debe invalidar sus callbacks al dispose o cambio de intención. No afirmo un fallo de selección actual ni un bug demostrado del controlador, que todavía no existe en este corte.
4. **Corrección documental menor.** EXECUTION-2A.md:37 y LOG.md:160 dicen 31 mutaciones; el script/results contienen **34**, incluyendo N1b/N2b/N5b, más N32: **35/35**. La evidencia real es más completa que la cifra.
5. **Trazabilidad desactualizada.** PARITY-2A.md sigue citando el título antiguo de VALIDATION-01, aunque el test ya fue corregido. No cambia el resultado funcional.
6. **Gates futuros anunciados sin implementación.** package.json:16 anuncia smoke Firefox/WebKit sin archivo/proyectos correspondientes; :21 anuncia check:parity sin script y con ruta local de mapa inexistente. No son gates funcionales del cierre acotado 2A, pero deben resolverse antes de exigirlos.
7. **No hay CI de calidad para el commit.** API de Actions devuelve 0 runs; los dos estados success son despliegues Vercel v5/v6. La rama no tiene checks obligatorios. No confundir despliegue exitoso con pruebas.

## Límite de navegador

La configuración versionada usa /opt/pw-browsers/chromium, inexistente aquí. Probé una copia del checker cambiando únicamente executablePath por /usr/bin/chromium 156 y la ruta de importación; no se cambió el repo. Chromium falla antes de abrir una página por socket() Operation not permitted. Una ejecución escalada admitida tampoco habilitó ese socket. Se detuvo esa vía.

No ejecuté E2E tres veces ni declaré un nuevo PASS de portabilidad. Los 16/16 E2E en tres corridas son **evidencia histórica del revisor**, sobre el mismo SHA256 del HTML que reconstruí. No se verificaron Firefox/WebKit, foco/IME real, interfaz conectada, rendimiento integral ni host/backend.

## Siguiente paso

Conservar código de 2A. Reconciliar el cierre estructurado y la matriz desde orquestación; anexar esta revisión y sus hashes. Mantener la navegación 2B aislada y probar éxito/fallo/busy/callback obsoleto sin inferir éxito de Promise<void>. Su gate browser requiere un entorno que sí permita lanzar navegador; esta auditoría no lo sustituye.

Fuentes principales:
- https://github.com/fegome90-cmd/turno/commit/e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b
- https://github.com/fegome90-cmd/turno/blob/e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b/docs/migration-v6/phase-2a/EXECUTION-2A.md
- https://github.com/fegome90-cmd/turno/blob/e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b/prototypes/frontend-v6/evidence/2A/LOG.md
- https://github.com/fegome90-cmd/turno/blob/e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b/prototypes/frontend-v6/src/app/store.ts

