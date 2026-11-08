# Ejecución de la fase 0 · tareas 0.1 a 0.3

Fecha: 08/11/2026. Orden del dueño: «Fase 0 ya». Roles en [G0-RECORD](G0-RECORD.md). Solo documentos; no se creó v6 ni se instalaron paquetes.

Ejecutores: subagente Claude Haiku (0.1, suite de 0.2 y lectura de 0.3); el orquestador completó build, huella y redacción porque el ejecutor terminó antes de escribir el registro.

## 0.1 · Referencia y alcance: PASS

| Dato | Valor |
|---|---|
| Copia Git | worktree de `/home/user/turno`, rama local `integracion-1-sobre-2` = remoto `frontend/fix-fullscreen-reflow-v8` |
| HEAD | `0712b4ca50cbc03ade95a463dddd72a7e7c0c2ec` |
| Base (`git merge-base HEAD origin/main`) | `addd5a3189e0c9acc5e9b2a5b12e64030228a39e` |
| `git status --short` | vacío |
| Entorno | Node v22.23.4, npm 10.9.9, Python 3.13.18, Git 2.43.0 |

Delta de v5 desde la referencia (`git diff --stat 0f534df..HEAD -- prototypes/frontend-v5`): 10 archivos, +164/−41.

- 7 archivos de prueba, todos en `approvedDeltas` de [baseline-files.json](../baseline-files.json): design-audit, design-complete, emil-skills, history, interface-skills, ui, viewport.
- 3 documentos admitidos como solo-documentación: README.md, docs/MIGRACION_REACT.md, docs/MOTION_V6.md.
- Ningún cambio en `src/`, assets ni scripts de v5.

Validaciones documentales (`python3 -I`, desde la raíz), todas con código de salida 0:

1. `docs/migration-v6/scripts/check_docs.py`: PASS, `errors: []` (7 JSON, 25 Markdown, 112 enlaces locales, 212 requisitos, 16 archivos fuente, 6 controles).
2. `-m unittest discover -s docs/migration-v6/agent-contracts/tests`: 79 pruebas, OK.
3. `contract_gate.py --baseline … --matrix …`: PASS.
4. `contract_gate.py … --brief brief-1A.json --report report-1A-stop.json`: PASS.

Los recuentos difieren de los de la preparación (5 JSON, 18 Markdown, 95 o 101 enlaces) porque desde entonces se añadieron GLOSARIO.md, phase-0/EXECUTION-0.md y design-audit/. No es una discrepancia de contenido.

## 0.2 · Baseline y vuelta segura: PASS

Suite completa, un archivo por vez, desde `prototypes/frontend-v5`:

```sh
for f in tests/*.test.mjs; do node --max-old-space-size=700 --test --test-concurrency=1 "$f"; done
```

| Archivo | Pasan | Fallan |
|---|---|---|
| design-audit | 11 | 0 |
| design-complete | 12 | 0 |
| draft | 3 | 0 |
| emil-skills | 16 | 0 |
| history | 10 | 0 |
| home-subtitle | 3 | 0 |
| interface-skills | 33 | 0 |
| motion | 6 | 0 |
| polish | 13 | 0 |
| preview | 20 | 0 |
| toasts | 22 | 0 |
| tokens | 2 | 0 |
| ui | 43 | 0 |
| validation | 2 | 0 |
| viewport | 11 | 0 |
| visibility | 5 | 0 |
| **Total** | **212** | **0** |

Build y comprobación portable:

- `python3 scripts/build_preview.py`: código 0, «Built preview.html: 1086162 bytes».
- `node scripts/check_portable.mjs`: código 0, PASS (con su propio límite: solo Node/LinkeDOM).
- `sha256sum preview.html`: `29e80f24c70e342b18b2f3f4023a4cf55e7e2dbb782292a5d57be5314c713c37`, 1.086.162 bytes. Idéntica a la registrada en G0-RECORD sobre `1d03821`: la referencia es reproducible.

Vuelta segura: `preview.html` es generado y no se versiona. Para reabrir la referencia, hacer checkout de este HEAD (o de cualquier commit con el mismo árbol de `prototypes/frontend-v5`), ejecutar `python3 scripts/build_preview.py` y comprobar la huella anterior. Recargar la página reinicia la sesión de demo. La reapertura en navegador del rollback final pertenece a G7A.

## 0.3 · Contrato y condiciones: hallazgos

Coinciden sin conflicto:

- D1, D2, D4, D5 (Chromium mínimo), D6 y las capas de host con PLAN.md (líneas 61–66, 370–371, 388, 395–401).
- D9 con el código: `src/motion.mjs` (pantalla 150, diálogo 240, drawer 260, disclosure 220, pestañas 150, feedback 180, avisos 300), `--motion-feedback:180ms` y sin escala al pulsar en `styles.css`; PLAN.md 346 y 350 ya corregidos.
- Navegación desde 700 px y Tiempo desde 1000 px (ACCEPTANCE y PLAN.md:25).

Inconsistencias (decisiones ya tomadas por el dueño que no llegaron a todos los documentos):

1. D7–D9 no están en PLAN.md. PLAN.md:57 dice «No rediseñar ni cambiar textos», y D7 cambia «Cama» por «Lista» ([GLOSARIO](../GLOSARIO.md)). PLAN.md no tiene la fase de identidad posterior que exige D8.
2. El añadido de D5 (revisión de diseño con Paper e Impeccable en las fases 3–4, ACCEPTANCE) no aparece en PLAN.md.
3. ADR-001 solo cubre D1–D6.
4. FASE_0.md:71 dice «las seis decisiones D1–D6».

No se resolvieron decisiones en esta tarea. Corresponde al orquestador incorporar lo ya decidido a esos documentos antes de las revisiones de especificación y calidad (tarea 0.4).
