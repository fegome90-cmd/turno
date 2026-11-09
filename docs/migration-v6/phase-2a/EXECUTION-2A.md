# Ejecución de la fase 2A · dominio y estado de sesión

Fecha: 09/11/2026. Encargo: [BRIEF-2A](BRIEF-2A.md). Roles: implementador Claude Haiku, orquestador Claude, revisor independiente Claude Sonnet. Registro: `prototypes/frontend-v6/evidence/2A/LOG.md`; dueños: `evidence/2A/OWNERSHIP.md`; paridad: `evidence/2A/PARITY-2A.md`; revisión: `evidence/2A/review/REVIEW-2A.md`.

**Resultado: G2A aprobado con observaciones** (APPROVE_PHASE, 0 BLOCK, 6 WARN). Sin interfaz conectada: el Inicio sigue con datos estáticos.

## Gates repetidos por el revisor desde `npm ci`

| Gate | Resultado |
|---|---|
| audit-total / audit-runtime | 0 hallazgos, código 0 |
| typecheck, lint | PASS |
| unit / component | 60/60 y 51/51 |
| build | PASS; `dist/preview.html` SHA256 `ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343`, 1.106.242 B (+10.600 B por importar dominio, adaptador y zustand en el arranque; comportamiento visible igual) |
| check:portable / measure:bundle | PASS / 1,018 × v5 |
| e2e | 16/16 en 3 corridas; evidencia versionada de 1A/1B sin cambios |

Paridad: las 30 filas de 2A (DRAFT-01..03, EMIL-SKILLS-07, POLISH-08..11, PREVIEW-01..20, VALIDATION-01..02) conservan valores esperados y aserciones de v5; única diferencia de texto D7 (`Lista 1`, `Lista 2`, `Lista no encontrada.`, `La lista no pertenece al turno.`). Dominio transcrito sin cambios de semántica. Mutaciones: implementador 10/10 detectadas; revisor 25/35 detectadas, las 10 restantes son huecos de prueba, no defectos.

Enmiendas al plan por la revisión: `parseDate` lanza como en v5 (la firma `string|null` omitía la excepción) y firma ampliada de `createSession`.

## Observaciones (huecos de prueba)

1. Borrador temporal crudo no probado tras fallo, conflicto y respuesta tardía (OWNERSHIP lo citaba como evidencia).
2. `select` no prueba el reinicio de borrador temporal ni de errores.
3. `trim()` del texto crudo cubierto a medias; título de prueba contradictorio en `validation.test.ts:43`.
4. «Vacío no es cero» sin oráculo en `applyTemporalDraft`.
5. Quitar `session.dispose()` de `startApp` no hace fallar nada.
6. `saveNote` del store sin prueba.

Sugerencias: `persist` descarta en silencio una acción concurrente (4A debe deshabilitar controles por `busy`); el adaptador acepta `24:00` y `openShift` en fecha UTC sin prueba.

No verificado: interfaz conectada, foco, IME, rendimiento comparado (7A), Firefox/WebKit, `check:parity` (script inexistente). Los `targetCases` de `parity-map.json` siguen como marcadores; la correspondencia real es el prefijo de ID en el nombre de cada prueba.
