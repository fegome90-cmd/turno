# Estado de preparación de la migración

Fecha de observaciones: 08/11/2026. Referencia: `0f534df9bd5b012b4ec21c202a055e1e913bcab5`, último código `7141568f9fc765a2a2555a689a4df76dc9bfa44f`. Árbol Git de referencia: `3003fe5b2b5dd7d7620564a1ec1e75df510ca06a`.

Se preparó un fixture aislado de herramientas y contratos. **No se implementó Turno React. G0 continúa pendiente.** Los resultados siguientes son observaciones de esa preparación, no una ejecución nueva de producto ni resultados del commit documental.

## Inicio operativo de fase 0, todavía sin ejecución

El [paquete de inicio](FASE_0.md) prepara entradas, roles, pruebas/gates, borradores de decisiones y registro STOP. No repite suite/build/auditoría ni desbloquea navegador. El corte documental inspeccionado fue `70167c2a3bfa2f2e4059c41fa6d0b84138eb38e6`; la referencia de comportamiento y los resultados históricos siguientes no cambian.

## Investigación posterior, sin reinstalación

La [investigación React del 08/11/2026](REACT_RESEARCH.md) contrasta las versiones del fixture con fuentes oficiales actuales y propone controles para G0, G1A, G1B, G6 y G7. No cambia los resultados históricos siguientes, no repite auditorías ni acredita una actualización instalada. El árbol de producto inspeccionado sigue vanilla con LinkeDOM dev; el lock del fixture está fuera de este repositorio. La ausencia de RSC en v5 no se atribuye automáticamente a un futuro v6 o al backend. **G0 sigue pendiente / no aprobado y conserva los FAIL y BLOCKED registrados.**

## Resultado por clase de evidencia

| Comprobación | Resultado registrado | Alcance |
|---|---|---|
| Integridad de referencia | PASS, 83/83 blobs | Mismos bytes que GitHub; repetido antes de publicar docs |
| Primera suite completa v5 | PASS, 212/212 | Node/LinkeDOM, concurrencia 1 |
| Última suite completa v5 | **FAIL, 210 PASS / 2 FAIL** | Mismo código; no estabilidad demostrada |
| Repetición de los dos casos fallidos | PASS, 2/2 | Focalizada; no reemplaza la suite fallida |
| Build y check portable v5 | PASS | HTML de 1.086.162 bytes, Node/LinkeDOM |
| Instalación limpia de fixture | PASS | Lock, `--ignore-scripts`, reinstalación desde caché oficial |
| Tipos y lint de fixture | PASS | TypeScript estricto, `skipLibCheck=false`, reglas de hooks |
| Tests de fixture | PASS, 2 unitarios y 1 componente | jsdom; ninguna paridad Turno |
| Build singlefile de fixture | PASS | Comprobación estática; no offline real |
| Ensayos negativos de fixture | PASS, 5 controles | Tipos, hooks, assertion y dos barreras browser |
| Playwright | PASS solo descubrimiento de 3 casos | Ningún motor ejecutado |
| Auditoría de dependencias runtime | PASS de advisories, 0 | No equivale a auditoría completa |
| Auditoría total del fixture | **FAIL, 10 moderadas dev**, 0 altas/críticas | Riesgo pendiente |
| Contratos | PASS estructural, 40 tests | Detector de metadatos; no garantía de comportamiento |
| Navegador, visual, dispositivo/AT real | **BLOCKED / no demostrado** | Sin QA visual ni navegador offline |
| Paridad React y host/backend | **NOT RUN** | No hay producto v6 ni integración |

Los estados PASS, FAIL, BLOCKED y NOT RUN se conservan por separado. Ni un build, ni una cifra de tests, ni ausencia de conflictos de merge aprueban los demás gates.

## Baseline no repetible

Comando completo, desde `prototypes/frontend-v5/` en una copia aislada:

```sh
node --test --test-concurrency=1 tests/*.test.mjs
python3 scripts/build_preview.py
node scripts/check_portable.mjs
```

El último recorrido completo registrado falló en:

1. [interface-skills.test.mjs:227–232](../../prototypes/frontend-v5/tests/interface-skills.test.mjs#L227-L232), `every completion checkbox sits in a 44px label hit area and one change completes the task once`. Esperaba `completed=true`, observó `false`.
2. [ui.test.mjs:152–156](../../prototypes/frontend-v5/tests/ui.test.mjs#L152-L156), `home summary uses singular pending copy and the start action when no shift is open`. Esperaba `Turno de día · 1 pendiente`, observó `Turno de día · 2 pendientes`.

Ambos pasaron al repetirlos focalizados sin editar fuente. Dos esperas del adaptador de 220 ms frente a una pausa fija del test de 500 ms sugieren sensibilidad al scheduler, pero **no se demostró causalidad ni un arreglo**. No se modifican tests, timeouts ni expectativas para obtener verde. Resolver la discrepancia o acordar un rebaseline explícito antes de certificar G0. Las pruebas nuevas deben esperar condiciones observables con límites acotados.

## Herramientas comprobadas en el fixture

Entorno de preparación: Node 24.22.1, npm 11.9.0, Python 3.12.14 y Git 2.52.0. Las versiones no se instalan ni se adoptan para producto por publicar este informe.

| Paquete | Versión exacta comprobada |
|---|---|
| react / react-dom | 19.3.1 |
| @base-ui/react | 1.9.0 |
| zustand | 5.1.0 |
| clsx | 2.1.1 |
| sonner | 2.0.8 |
| lucide-react | 1.70.0 |
| typescript | 6.0.3 |
| vite | 8.3.6 |
| @vitejs/plugin-react | 6.2.1 |
| vite-plugin-singlefile | 2.3.4 |
| vitest | 4.1.12 |
| jsdom | 31.0.0 |
| @testing-library/react | 16.3.3 |
| @testing-library/user-event | 14.6.8 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/dom | 10.4.2 |
| @playwright/test | 1.65.0 |
| @axe-core/playwright | 4.14.0 |
| eslint | 10.14.0 |
| @eslint/js | 10.0.1 |
| typescript-eslint | 8.72.1 |
| eslint-plugin-react-hooks | 7.1.1 |
| @types/react / @types/react-dom | 19.3.0 |
| @types/node | 24.19.2 |
| globals | 17.14.0 |

El fixture y su lock se conservan fuera del árbol de producto. Este inventario documenta el conjunto probado; no es un scaffold instalable desde esta carpeta. Antes de crear v6 se deberá fijar su propio lock, comprobar compatibilidad y repetir los checks contra ese árbol.

Compatibilidades observadas:

- TypeScript 7.0.2 no satisface el peer `<6.1` de typescript-eslint 8.72.1.
- Vitest 5.1.0 y jest-dom 7.0.1 resolvieron peers, pero fallaron tipos por declaraciones incompatibles de `Assertion`. Vitest 4.1.12 pasó sin `skipLibCheck` ni parches a node_modules.
- jsdom 31 exige una versión reciente de Node; el fixture acotó el major probado a `>=24.15.0 <25`. No se atribuye al conjunto el mínimo histórico de v5.
- No se adoptaron next-themes, motion, Tailwind ni router. Tema solo de sesión; Sonner sigue condicionado a demostrar paridad.

## Diez moderadas de desarrollo pendientes

`npm audit` registró 10 moderadas, sin altas ni críticas. `npm audit --omit=dev` registró cero. Los avisos proceden de minimatch 10.2.6 en la cadena de lint/parser, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), por posible denegación de servicio con patrones de glob no confiables. No se observan en runtime.

La corrección 11.0.5 queda fuera del rango de sus consumidores. El ensayo de downgrade ESLint 9.39.5 + parser 8.36.0 + TypeScript 5.8.3 conservó 7 moderadas y se rechazó. No se aplicó `audit fix --force`, override de major ni `legacy-peer-deps`. La auditoría total sigue FAIL; resolver este riesgo antes de uso no acotado del tooling; registrar una aceptación humana no cambia FAIL/STOP de los gates de producto.

## Límites de navegador y aceptación

La preparación no dispuso de una vía de navegador permitida. No se ejecutó el prototipo por rutas alternativas ni se descargaron binarios. El descubrimiento de Playwright no demuestra arranque de motores.

Continúan sin demostrar: `file://` y offline real, foco e historial nativos, composición IME real, teclado móvil/táctil, pantalla completa, iframe/host, lectores de pantalla, movimiento, colores forzados, zoom y revisión visual. LinkeDOM, jsdom, axe y comprobaciones estáticas no sustituyen esas evidencias. Para continuar se requiere una vía permitida y evidencia del árbol final, sin rebajar gates.

## Procedencia y publicación

- Código y nombres fuente: [referencia GitHub fijada](https://github.com/fegome90-cmd/turno/tree/0f534df9bd5b012b4ec21c202a055e1e913bcab5).
- Plan auditado original del 08/11/2026: SHA256 `39aedc749615dcffd25ee504aff5a434528099b1d619513fde738b378c856af5`. La edición de publicación de [PLAN.md](PLAN.md) elimina contexto personal, actualiza el anexo de evidencia y enlaza el estado posterior, conservando requisitos y tareas.
- Paquete de preparación archivado del 08/11/2026: SHA256 `0e7234b3a09e39066c7f23e881c0f5508a3c15246b7be9da5660938ab335859e`. Este resumen se contrastó con sus resultados de suite, integridad y auditoría.
- Se publican únicamente plan, matriz, resumen y contratos/checker con sus tests y ejemplos. No se publican el fixture completo, datos privados, conversaciones, archivos generados, capturas ni logs brutos. Los hashes anteriores identifican los originales archivados; no son hashes de los documentos editados en este PR.

No se concede una licencia nueva al proyecto o a la marca mediante esta documentación. Las atribuciones de recursos de terceros permanecen en [licenses](../../prototypes/frontend-v5/licenses/).

## Auditoría estructurada y aceptación de riesgo

Registrar o aceptar un riesgo del fixture puede resolver una decisión de preparación, pero no aprueba G0 ni convierte la auditoría de producto en PASS. El [contrato del checker](agent-contracts/prompts/00-contract.md) exige auditorías total/runtime frescas sobre manifest/lock/SHA/árbol del producto. En este MVP cualquier vulnerabilidad conserva FAIL/STOP, incluso con aceptación documentada; no hay excepción automática para iniciar/cerrar 1A, fases siguientes o cierre final. Resolver y auditar otra vez, o proponer por separado una política revisada. Infraestructura fallida es BLOCKED, nunca cero advisories. G0 sigue STOP.
