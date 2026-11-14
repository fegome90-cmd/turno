# Evaluación mínima de notas — PR #4

Base de integración: `e3cd48dc9ebf68523fea07a97f6982f32a79a6ee`.
Portado desde el parche mínimo verificado sobre la copia experimental
`32ed05744d8cc86b91b5671c71cc84550d1fb6c8`.

## Alcance

Turno es un gestor de propósito general. Esta guía valida el evaluador y las pruebas; no certifica un sistema clínico ni autoriza uso de datos reales. Las [puertas de merge, activación y uso real](../../docs/agente-roadmap.md#alcance-vigente-y-puertas-del-pr-4-14-11-2026) se verifican por separado. Las limitaciones de `ext-22`, D4 y revisión independiente no se dan por cerradas.

Solo evaluador, corpus sintético de desarrollo, pruebas y esta guía.
No incorpora los cambios experimentales de prompts P01–P05 ni modifica
clasificadores, motor, duplicados, dependencias o corpus históricos.
El conjunto `--goals` expresa expectativas de desarrollo; sus resultados
con oráculo NO demuestran que el prompt vigente las cumpla con modelos.

`--strict` verifica ejecución completa y rúbrica, no fidelidad semántica.
Un error en los campos anotados `requiredExactTerms` bloquea la meta global,
aunque se alcance 5/6 de títulos útiles. Nombres, códigos y frases críticas
se comparan completos, normalizando NFC, mayúsculas y espacios, pero no
borrando tildes, puntuación interna ni dígitos. La corrección vive en el
evaluador: no bloquea automáticamente una sugerencia de producción.

## Reproducción sin modelos

Desde `server/`, en copia aislada y sin enlazar `node_modules`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
node eval/run-note-eval.mjs --goals --strict
node eval/run-note-eval.mjs --extended --probe --mode DECISION --max-calls 120 --strict
node eval/run-note-eval.mjs --extended --probe --mode DECISION --reps 3 --max-calls 350 --strict
```

El conjunto de desarrollo espera 20/20 con oráculo. El corpus histórico
conserva `ext-22`: 55/56 o 165/168; los dos últimos comandos deben salir con
código 1. No cambiar la expectativa para ocultarlo. El límite cuenta
invocaciones lógicas, no solicitudes HTTP internas ni dólares. Sin ampliar
el límite predeterminado de 60 se procesan solo 40/56 casos.

## Límites abiertos

Negaciones, relaciones, roles, sinónimos y correferencias no quedan
certificados por coincidencias literales. Conservar revisión humana y
validación independiente; no interpretar `--strict` como autorización de
merge. No se implementa `context-delta`. Una prueba live requiere entorno,
credenciales, autorización y presupuesto; no se ejecuta al aplicar este
parche ni se activa IA en producción.

## Verificación de este port (14-11-2026)

Node v24.22.2 y npm 11.20.0; instalación limpia desde lockfile, sin enlaces a
otras dependencias. Base del PR: 333 PASS, 0 FAIL, 1 SKIP. Tras el port:
30/30 pruebas específicas y 363 PASS, 0 FAIL, 1 SKIP en la suite completa.
El SKIP corresponde a la referencia histórica opcional NOTE_RUN3_REF.
`npm run check`, el escáner de secretos y `git diff --check` pasan.
Oráculos offline: goals 20/20; histórico 55/56 y 165/168, con ext-22 visible.
Reproducido antes/después: Paolo aprobaba el caso que exigía Paola; ahora
falla ese caso y bloquea la meta global, incluso con 5/6 títulos útiles.
No hubo inferencia real. No se valida semántica general ni context-delta.

Parche fuente: `turno-minimal-verification.patch`, SHA-256
`0ab96a0779ee8a5bc3b052f9645d94342a7f25d049bd04f455521316623ed8d5`.
Fue necesario portarlo porque su base experimental no estaba en el PR #4;
solo se incorporan sus prerrequisitos de evaluación, no los prompts.
