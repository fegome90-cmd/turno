# AGENTS.md — Gobernanza del Repositorio Turno

## Fronteras y SSOT por Subproyecto

- `prototypes/frontend-v5/`: Baseline de referencia **protegido** (solo lectura salvo autorización humana explícita; integridad verificada por `python3 docs/migration-v6/scripts/check_docs.py` contra `docs/migration-v6/baseline-files.json`). Ver `prototypes/frontend-v5/README.md` y `prototypes/frontend-v5/package.json`.
- `prototypes/frontend-v6/`: Candidato React activo en sesión en memoria (sin backend ni persistencia). Ver `prototypes/frontend-v6/package.json`, `prototypes/frontend-v6/.oxlintrc.json` y `prototypes/frontend-v6/README.md` como SSOT de versiones, scripts y requisito de Node.
- `docs/migration-v6/`: Matriz de paridad, verificación de integridad (`scripts/check_docs.py`) y contratos (`agent-contracts/contract_gate.py`). Ver `docs/migration-v6/README.md` (requiere Python `>=3.12`).
- `server/`: Piloto de agente ambiental y evaluación sintética (Node `>=22.0.0`, Strands SDK y Cedar Policy; desacoplado de los prototipos de interfaz). Ver `server/README.md` y `server/package.json`.

## Comandos Raíz y Activación de Hooks

- Activar hooks por clon: `git config core.hooksPath .githooks`
- Escáner de secretos y suite: `node server/scripts/check-secrets.mjs` / `node --test server/tests/no-secrets.test.mjs`
- Integridad documental y protección `v5`: `python3 docs/migration-v6/scripts/check_docs.py`
- Comandos de subproyectos: usar `npm --prefix prototypes/frontend-v6 <ci --ignore-scripts | run <script>>`, `npm --prefix prototypes/frontend-v5 <ci --ignore-scripts | test>` y `npm --prefix server <ci --ignore-scripts | run check | test>`.

## Reglas Operativas

1. **Commits:** Conventional Commits únicamente (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`); prohibido agregar `Co-Authored-By` o firmas de IA.
2. **No compilar tras cambios:** No ejecutar `npm run build` automáticamente tras editar código, salvo pedido explícito o ejecución directa de gates que requieran artefacto compilado.
3. **Aislamiento:** Prohibido crear `package.json` o `workspaces` en la raíz (mantiene `package.json`, lockfiles y `engines.node` aislados por subproyecto conforme a `docs/migration-v6/PLAN.md`).
4. **Secretos:** Prohibido versionar `.env`, `.env.*` (salvo `.env.example` con variables vacías), `.envrc*` o credenciales literales; validado al commitear por `.githooks/pre-commit`.
5. **Linter y Navegador (`frontend-v6`):** Conservar Oxlint (`prototypes/frontend-v6/.oxlintrc.json`, sin cambiar a Biome ni sumar plugins incompatibles). Usar **Playwright** para regresión E2E, portabilidad `file://` y smoke multi-motor; usar **Chrome DevTools MCP** para diagnóstico interactivo de DOM, CSS, consola y red.
