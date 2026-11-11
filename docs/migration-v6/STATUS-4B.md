# Estado de Turno v6 · 4A/4B y correcciones posteriores

Corte documental: **10/11/2026**. Candidato de código `ed374be`; aceptación formal **STOP**. Este documento actualiza los índices. No aprueba G4A/G4B ni 5A, no modifica el canon ni acredita publicación, merge o despliegue.

## Fuente exacta

- Commit de código: `ed374bed7116d413fa3450d72b61cad4866319a4`.
- Árbol Git de ese código: `e3cb9d15e5ecf93940998220cc2b025183569f68`.
- SHA-256 del bundle completo de código: `d2bcb816ea2938863c974e08a602dea64677e6f30d7d32e17e680ae8402be029`.
- SHA-256 del HTML de producto comprobado: `dc0122b5fe975f5fa4702818d41fa97a07f0e1c9562dcec4bf84819cc63942bd`.

Estas identidades corresponden al corte probado, anterior a esta actualización documental. El bundle de código contiene 108 commits, historia completa, sin objetos faltantes ni errores de `git fsck --strict`. El respaldo documental local conserva ese código como ancestro sin modificar producto, pruebas ni dependencias. La incorporación mediante el plugin GitHub usa un snapshot nuevo sobre `fd777bf`: conserva la historia remota existente y la misma fuente de producto, sin importar los SHA locales. El bundle completo resguarda por separado la historia local original.

## Producto implementado

El [frontend v6](../../prototypes/frontend-v6/README.md) integra editores y notas, Tiempo/Agenda, guardas, historial, creación de tareas/listas/notas, renombrado de listas, cierre/apertura de turnos y archivo de sólo lectura. Funciona con datos sintéticos en memoria de sesión: se pierden al recargar. No incluye backend, autenticación, persistencia, colaboración ni integración con el host ChatGPT.

Después de `3495144` se corrigieron el retorno de foco al editor, el estado de solicitudes terminadas, la claridad del cierre de turno y el comportamiento de los avisos persistentes. El último cambio, de `e1cd8d2` a `ed374be`, sólo toca `NotificationStack.tsx` y su suite de componentes: Option/Alt+T reconoce T lógico o la posición física `KeyT`, respeta composición y eventos consumidos, y conserva los filtros de modificadores, suspensión y pila vacía.

## Verificación del candidato ed374be

- Tipos, lint, 162 pruebas unitarias, 319 pruebas de componentes y tres builds: PASS en Node 24.22.1.
- Chromium Mac: corrida nueva 226/226 PASS, sin skips, flaky ni retries, con Node 24.18.0. Los escenarios técnicos de los harnesses se distinguen de la integración del App real.
- Portable: PASS sobre el HTML exacto, con cuatro fuentes cargadas, cero solicitudes externas, errores de consola o errores de página.
- TDD del atajo: cuatro fallos conductuales con la fuente anterior y pruebas nuevas; 24 casos de notificaciones pasan después. Un replay independiente conservó los cuatro RED. Ese subconjunto no se suma de nuevo a las 319 pruebas de componentes.
- Safari macOS: el informe manual registra comprobaciones del gesto nativo Option+T, supresión de `†`, foco, Escape y conservación del estado dirty. La procedencia es indirecta para el revisor y no hay capturas archivadas de esa sesión. Es evidencia acotada del atajo en Mac, no de Safari iOS ni de todas las distribuciones de teclado.

La primera corrida Chromium se conserva con 169 PASS, 14 FAIL y 43 sin ejecutar por ubicación incorrecta de los builds de harness. Sólo se corrigió la ubicación de los mismos builds; una corrida nueva y separada produjo el 226/226. El resultado anterior no se reetiquetó como PASS.

Estas pruebas no certifican iPhone físico, tecnologías de asistencia integrales, IME físico ni una nueva validación de zoom nativo del candidato corregido. La revisión independiente fue favorable dentro del alcance del fix, sin aceptar fases.

## Auditorías y aceptación

El expediente histórico de `3495144` registró nueve gates técnicos PASS y dos auditorías BLOCKED. Las regresiones posteriores no cambian la decisión formal: **G4A/G4B siguen STOP**.

Las auditorías total y runtime de dependencias no se han ejecutado por restricción de acceso. No hay respuesta JSON ni código de salida de npm para estas auditorías, por lo que el resultado sobre vulnerabilidades sigue desconocido. La autorización explícita para enviar nombres y versiones a `registry.npmjs.org` permanece pendiente. No se reintentaron ni se sustituyeron por otro registro.

Las 27 identidades de cierre previstas para 4B siguen `planned`; UI-36 sólo tiene preparación para 5A. Las 212 identidades canónicas permanecen intactas. Los resultados técnicos no cierran filas automáticamente ni sustituyen la aceptación formal. No se modifican plan, matrices, manifiesto de referencia ni `approvedDeltas` mediante esta actualización documental.

El [estado 2B](STATUS-2B.md) y el [registro 3A](../../prototypes/frontend-v6/docs/EXECUTION-3A.md) se conservan como evidencia histórica. Sus descripciones de producto parcial y gates pendientes corresponden a sus propios cortes.

## Siguiente alcance previsto

Resolver las auditorías y la aceptación formal antes de presentar estas fases como aprobadas. El siguiente alcance previsto, 5A, aborda avisos persistentes de interfaz y D12: 21 identidades de cierre. La familia TOASTS reúne 22 contratos; 12 de movimiento se cierran en 6A. TOASTS-13 sigue `planned` con cierre previsto en 5A; el fix del atajo no cierra G5.

El usuario autorizó subir una rama mediante el plugin GitHub aun si genera una vista previa Vercel que podría ser accesible por enlace. Se usa un commit snapshot nuevo con trazabilidad al código probado, sin reescribir la historia remota ni alterar ramas ajenas. No se modifican permisos, protección de despliegues ni integración con Vercel. La autorización del posible preview no aprueba gates ni inicia una fase nueva.
