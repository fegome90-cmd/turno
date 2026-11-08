# React al 8 de noviembre de 2026: decisión de migración

**Estado: investigación y recomendación condicionada, no actualización de producto.** Se contrastan publicaciones, releases y metadatos oficiales con el árbol de PR #2 en `06f1bf4e2d8eed0e8d754627d248dc63e30b7d51`. Publicar este documento no instala paquetes, no activa Compiler ni crea `frontend-v6/`. No acepta decisiones pendientes ni aprueba G0.

La [preparación registrada](PREFLIGHT.md) conserva su resultado: último completo v5 **210 PASS / 2 FAIL**, **10 moderadas dev** en el fixture y navegador **BLOCKED**. Las 212 identidades siguen `planned`. La documentación no sustituye corregir o acordar esas discrepancias, obtener aceptación del plan y disponer de una vía permitida para las pruebas reales.

## 1. Qué existe y qué se propone

En el árbol inspeccionado, [package.json de v5](../../prototypes/frontend-v5/package.json) no declara dependencias de runtime y solo declara `linkedom: 0.18.15` como dependencia de desarrollo. Su [lockfile](../../prototypes/frontend-v5/package-lock.json) contiene 20 entradas de paquetes, además de la raíz: ninguna de React, React DOM ni `react-server-dom-*`. El código de producto continúa siendo vanilla y la demo usa datos sintéticos en memoria. No existe implementación React ni lock de producto v6 en esa referencia.

El fixture aislado descrito en PREFLIGHT ya ensayó React 19.3.1, Base UI 1.9.0 y el conjunto indicado abajo. Su lock no se publica en esta carpeta. Sus resultados pertenecen a ese fixture, no a Turno React ni al commit documental. Esta investigación no vuelve a instalarlo, auditarlo o ejecutar producto.

**Recomendación para una futura fase 1A autorizada:** conservar SPA cliente, TypeScript y Base UI, con el conjunto compatible probado como punto de partida. No añadir Next.js, RSC, Server Functions, persistencia ni backend. El objetivo es paridad y un HTML autónomo, no incorporar todas las APIs nuevas.

## 2. Versiones: upstream, fixture y adopción pendiente

Corte de consulta: **08/11/2026**. Los tags son una foto temporal, no una política de actualización automática. Antes de crear el lock final, volver a consultar releases, peers, engines y avisos oficiales.

| Pieza | Referencia oficial actual | Estado en Turno / decisión propuesta |
|---|---|---|
| React / React DOM | **19.3.1**, release del 14/10/2026; minor 19.3 del 09/09/2026 | Ambos 19.3.1 en el fixture registrado. Ninguno instalado en producto; mantener versiones iguales al crear v6. |
| Tipos de React / React DOM | **19.3.0** en el conjunto documentado | Numeración independiente: no inventar `@types/*@19.3.1` por copiar el parche runtime. Revalidar los tipos al fijar el lock. |
| `@base-ui/react` | **1.9.0**, 09/10/2026 | Versión del fixture. Sus peers admiten React y React DOM `^17 || ^18 || ^19`; eso no demuestra composición, foco ni paridad. |
| Vite | **8.3.6**, 05/11/2026, bundler Rolldown | Versión del fixture. Revisar plugins y empaquetado contra Vite 8; no asumir equivalencia con recetas antiguas de Rollup. |
| `@vitejs/plugin-react` | **6.2.1**, 02/11/2026 | Peer Vite `^8.0.0`; engine Node `^20.19.0 || >=22.12.0`. No copiar opciones retiradas. |
| TypeScript | **7.0.2** es la release estable más reciente consultada | **6.0.3** es la recomendación condicionada y versión del fixture con typescript-eslint 8.72.1. El soporte publicado de typescript-eslint es `>=4.8.4 <6.1.0`: no adoptar TS 7 automáticamente. |
| React Compiler Babel | **1.0.0** estable, anunciado 07/10/2025 | Opcional, no instalado ni acreditado en producto/fixture por este documento. Probar por separado, después de paridad. No confundir con el port nativo experimental Oxc. |

Fuentes versionadas: [React 19.3.1](https://github.com/react/react/releases/tag/v19.3.1), [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [Base UI 1.9.0](https://base-ui.com/react/overview/releases/v1-9-0), [peers de Base UI](https://github.com/mui/base-ui/blob/v1.9.0/packages/react/package.json), [Vite 8.3.6](https://github.com/vitejs/vite/releases/tag/v8.3.6), [plugin React 6.2.1](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.2.1), [package del plugin](https://github.com/vitejs/vite-plugin-react/blob/plugin-react%406.2.1/packages/plugin-react/package.json), [TypeScript 7.0.2](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2), [soporte typescript-eslint](https://typescript-eslint.io/users/dependency-versions/), [Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1).

El mínimo de Vite no es el mínimo de todo el conjunto: jsdom 31 y las demás herramientas también imponen engines. El fixture usó **Node 24.22.1 / npm 11.9.0**, con rango de engines configurado `>=24.15.0 <25`; la versión ejecutada fue 24.22.1. Fijar el Node realmente validado en `.node-version` y `engines`; no anunciar compatibilidad de todo el proyecto con Node 20.19 por leer solo Vite. Conservar las versiones conjuntas de PREFLIGHT como referencia: Vitest 5.1.0 con jest-dom 7.0.1 falló tipos; Vitest 4.1.12 pasó sin `skipLibCheck`. Resolver peers no equivale a tipos ni tests aprobados.

Latest estable es el canal de partida para consumo directo. Canary no sigue semver y Experimental no garantiza estabilidad. Fijar versiones y lock, no copiar versiones canary de ejemplos incrustados en un post. Véase la [política de versiones React](https://react.dev/community/versioning-policy).

## 3. Novedades útiles, sin ampliar el alcance

- **React 19.3:** `ViewTransition`, `addTransitionType` y Fragment refs son estables. Pueden ayudar con transiciones o foco/medición de grupos sin wrapper, pero no reemplazan automáticamente CSS/Base UI ni el contrato de foco de diálogos. Postergar su uso hasta demostrar una mejora concreta y paridad. Las actualizaciones urgentes no se deben convertir indiscriminadamente en transiciones ni mezclar con `document.startViewTransition` manual sin diseñar su coordinación.
- **Movimiento:** si se evalúa ViewTransition en G6, medir con el build final, probar interrupciones, fallback sin soporte y `prefers-reduced-motion`. React no desactiva automáticamente estas animaciones por esa preferencia. Conservar todas las animaciones requeridas y no añadir cross-fades por defecto como efecto lateral.
- **React 19.2:** Activity conserva estado oculto pero desmonta efectos mientras está oculto; requiere revisar suscripciones y temporizadores. `useEffectEvent` permite lógica no reactiva dentro de efectos, no es una forma de silenciar dependencias del linter. Performance Tracks sirve para medir, no acredita una mejora de Turno sin medición.
- **React 19:** ref como prop y Actions de cliente pueden simplificar componentes nuevos. No obligan a añadir servidor ni permiten cambiar guardado, reset de formularios, borradores o confirmaciones. `useActionState` no autoriza conectar backend.
- **Fuera de la base cliente:** `browser()` trata comportamiento SSR; no se necesita por tener una SPA. Trusted Types evita coerciones, **no sanitiza HTML** ni sustituye CSP. Mantener texto literal y la prohibición de `dangerouslySetInnerHTML` del plan. Prerender/resume, cacheSignal y APIs RSC no justifican ampliar arquitectura.
- **Base UI 1.9.0:** headless y tree-shakable, no una identidad visual lista. Conservar tokens y fuentes; probar portales, stacking, tema y retorno de foco en el contenedor final. La guía documenta `isolation: isolate` y consideraciones de backdrop/Safari iOS 26+. El filtrado de Menu anunciado en 1.9.0 es **preview**: no hacerlo necesario para una función esencial.

Fuentes: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [React 19.2](https://react.dev/blog/2025/10/01/react-19-2), [React 19](https://react.dev/blog/2024/12/05/react-19), [ViewTransition y reduced motion](https://react.dev/reference/react/ViewTransition#always-check-prefers-reduced-motion), [Base UI quick start](https://base-ui.com/react/overview/quick-start), [accesibilidad Base UI](https://base-ui.com/react/overview/accessibility).

V5 no necesita una actualización React 18→19: aún no usa React. La [guía React 19](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) sirve como prevención al escribir código nuevo: createRoot y JSX moderno, tipos React 19, refs/cleanup correctos y nada de APIs retiradas como ReactDOM.render, findDOMNode o string refs. React 19 no distribuye UMD oficial; no diseñar el HTML portable sobre URLs UMD de React 18.

## 4. Seguridad: alcance comprobado y comprobaciones pendientes

Los avisos oficiales del **14/10/2026** son [RCE en React Server Components, GHSA-xqc2-xf4c-x3h3](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) y [DoS en Server Functions, GHSA-h3gv-c5rc-p453](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453). Nombran `react-server-dom-webpack`, `react-server-dom-parcel` y `react-server-dom-turbopack`. Sus tablas de versiones corregidas indican **19.0.9, 19.1.10, 19.2.9 y 19.3.1**. Usar las tablas, no perpetuar erratas de la prosa ni recomendar 19.2.4 desde artículos de 2025/enero de 2026. Revisar también el [índice de avisos oficial](https://github.com/react/react/security/advisories) al fijar dependencias.

Los avisos excluyen aplicaciones cuyo código React no usa servidor, o que no usan un framework/bundler/plugin con soporte RSC. El lock v5 inspeccionado no contiene React ni esos paquetes; no se identifica allí la dependencia afectada. **Esto no es una auditoría del futuro v6 ni del backend/host.** Declarar «SPA» no basta para concluir ausencia de exposición en un árbol nuevo. En 1A y de nuevo en 7A, inventariar dependencias directas/transitivas, configuración, plugins y modo de ejecución del árbol final; si aparece RSC, detener y revisar alcance, versiones y avisos antes de continuar.

Las **10 moderadas dev de minimatch** registradas en el fixture son un riesgo distinto. Los parches RSC no las resuelven. El histórico `npm audit --omit=dev` de cero tampoco convierte la auditoría total en PASS ni certifica XSS, renderizado literal, URLs o límites de entradas. Repetir auditoría total y runtime contra el lock nuevo, guardar los resultados separados y resolver o aceptar explícitamente el riesgo permitido. No aplicar `audit fix --force`, overrides de major, `legacy-peer-deps` ni desactivar checks para obtener verde.

## 5. Compiler y toolchain: prueba aislada posterior

Compiler Babel estable 1.0.0 puede evaluarse incrementalmente tras paridad y con Rules of React/ESLint comprobadas. Conservar memoizaciones existentes al principio; quitarlas en bloque puede cambiar comportamiento. Fijar el compilador y su integración de forma reproducible y comparar flujos con y sin Compiler. Verificar transformación en build o DevTools además de tests; una marca de memoización no acredita una mejora de rendimiento.

En `@vitejs/plugin-react >=6`, la opción inline `react({ babel: ... })` fue retirada. La [instalación oficial](https://react.dev/learn/react-compiler/installation) documenta `react()` junto a `@rolldown/plugin-babel` y `reactCompilerPreset()`, con peers Babel compatibles. Por separado, `react({ compiler: true })` usa el port nativo **experimental** Rust/Oxc, según el [README versionado de plugin-react 6.2.1](https://github.com/vitejs/vite-plugin-react/blob/plugin-react%406.2.1/packages/plugin-react/README.md). No son dos nombres para una misma integración estable. No activar el port experimental en la base de paridad.

El ensayo opcional necesita alcance/revisión propios y no bloquea entregar paridad sin Compiler. Exigir equivalencia en refs, efectos, edición/IME, historial y overlays, sin borrar memos automáticamente ni ocultar avisos. Una exclusión temporal `use no memo` debe quedar justificada y revisada. Véase [adopción incremental](https://react.dev/learn/react-compiler/incremental-adoption).

Vite **transpila TypeScript, no comprueba tipos**. Mantener comandos distintos para tipos completos, lint, unidad, componente, E2E, build, portable y paridad. No usar dev server, peers resueltos o build como sustituto de typecheck. Fuente: [TypeScript en Vite](https://vite.dev/guide/features#typescript).

## 6. Portabilidad: el contrato de Turno no cambia

El plan exige **un HTML autónomo que abra por doble clic, sin red**, con fuentes/iconos incluidos, además de comprobación HTTP separada. Vite permite una SPA estática, pero su build normal ni `base: './'` demuestran ese contrato. El [build de Vite](https://vite.dev/guide/build) y las [restricciones de módulos del navegador](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) obligan a validar el empaquetado específico singlefile.

Comprobar `dist/preview.html` final por hash: no imports/chunks, CSS, fuentes, iconos ni peticiones necesarias fuera del archivo; apertura fría `file://`, recarga sin red, temas, overlays, edición y navegación en un motor real permitido. El smoke HTTP mantiene disponible el servidor del documento y bloquea orígenes externos; no promete recarga con servidor caído. No añadir service worker, CDN, router o persistencia para sortear un problema de packaging. Mantener sesión en memoria y su reinicio al recargar, como exige el plan.

El PASS estático/LinkeDOM previo no demuestra offline nativo. Mientras no haya una vía de navegador permitida, los gates correspondientes permanecen BLOCKED. No descargar motores ni cambiar herramienta, puerto o protocolo para evadir la denegación previa. La integración host/backend continúa fuera de alcance.

## 7. Aplicación operativa a los gates existentes

Estos controles son **propuestos para la ejecución futura**, no evidencia ejecutada ni una nueva aprobación de fase. Se incorporan en el plan y en el contexto de cada encargo; no modifican las 212 identidades ni los seis controles EXTRA canónicos.

| Fase / gate | Comprobación y evidencia exigida al ejecutar |
|---|---|
| 0 / G0 | Releer este corte, PREFLIGHT y delta de HEAD; distinguir versión instalada, ensayada y propuesta. Mantener STOP por baseline/auditoría/aceptación pendientes. Inventariar vanilla actual y contrato sin persistencia. |
| 1A / G1A | Elegir y fijar conjunto compatible + Node/lock; instalación limpia; registrar peers/engines, versiones reales y árbol de RSC/config; auditoría total/runtime, typecheck sin ocultar tipos, lint, tests y build por separado. Probar HTML final offline en motor permitido; sin navegador, BLOCKED. No activar Compiler/Oxc como efecto lateral. |
| 1B / G1B | Verificar APIs/exportaciones de Base UI fijado, portales/stacking/tema, Escape, Tab y retorno de foco reales. No depender de Menu filtering preview; peers compatibles no acreditan estas interacciones. |
| 6A / G6 | CSS/Base UI primero. APIs nuevas solo por mejora concreta aceptada, con reduced motion, interrupciones y fallback; medir build final. Compiler opcional en cambio aislado, con equivalencia y verificación de transformación. No atribuir benchmarks upstream a Turno. |
| 7A / G7A | Repetir inventario/seguridad y todos los checks contra lock/SHA final; distinguir cero advisories runtime de auditoría total y pruebas de seguridad de aplicación. Revalidar portable por hash, sin red. No reciclar evidencia del fixture. |
| 7B / G7B y H | Mantener QA manual/dispositivo/AT y host como clases separadas. Nada aquí cierra G7B ni H, y una API estable no certifica accesibilidad, rendimiento o producción. |

El checker documental y los 44 tests de contratos validan estructura y trazabilidad ya definidas; **no ejecutan ni verifican automáticamente estos nuevos criterios técnicos**. Al autorizar la implementación, el responsable debe incorporarlos a comandos/casos y evidencias del brief aplicable, revisarlos independientemente y mantener STOP ante faltantes. No añadir datos inventados a un reporte para satisfacer el checker.

## 8. Límites de esta actualización

Se inspeccionaron manifests/lock y documentación del snapshot remoto y se consultaron fuentes oficiales. No se instalaron paquetes, activó Compiler, ejecutó navegador ni repitieron suites, build o auditorías de producto. Las compatibilidades upstream y el fixture son antecedentes; las de v6 deben demostrarse contra su árbol final. No hay merge, despliegue, integración con otros trabajos ni cambio de permisos. Las optimizaciones opcionales no amplían los objetivos ni levantan los bloqueos vigentes.
