# Auditoría independiente: cierre y foco 2B

## Dictamen acotado
PASS no visual de 72459f5ffc3c48db4202792208370b4ca92d5426, árbol Git a4a7fe3c5b06f1ac4abcd5d9a7dd6435c73f458e. No se detectaron nuevos bloqueantes funcionales en el alcance revisado. Se cierra el hallazgo previo de la política blob. G2B queda pendiente de Chromium final y contrato/evidencia del candidato efectivo; no certifico foco visual ni AT desde JSDOM.

## Alcance
Copia propia turno-2b-review; árbol limpio. Se comparó contra4234a8e y contra el runtime7b ya revisado. El diff afecta al harness, test de componente, dos aserciones E2E y helper/test de política. Controlador, hook, dominio, store, dependencias y producto no cambian.

## Revisión del foco
La traza pasiva Mac histórica distingue causa y síntoma: en el candidato anterior el textarea pierde foco al popup que aún cierra y luego a BODY, antes de invocar «Resolver respuesta antigua». No atribuir ese fallo a una ejecución del guardado viejo.

HistoryHarness.tsx:68–71 y80–86 mantienen la decisión pendiente hasta finalizar el cierre. :110–116 utiliza la API pública Base UI onOpenChangeComplete(false); difiere resume a una microtask tras la limpieza síncrona de la capa. La implementación instalada de Base UI1.9.0 confirma que este callback pertenece al desmontaje de la capa; no se cambian internals de la librería ni se añaden temporizadores arbitrarios.

Autoridades separadas: el diálogo controla foco/desmontaje; el controlador conserva validación de identidad/revisión de navegación (:84–87) y disposal (:180–182). Las guardas bloquean navegación durante cierre (:44–48). Volver borra afterClose y pendiente, incrementa generación y cancela intención actual (:59–66). El callback se consume una sola vez; no se otorga al guardado una autoridad nueva sobre store.

## Pruebas adicionales independientes
En turno-2b-focus-adversarial se suspendió el cierre mediante la promesa getAnimations().finished para revisar orden y cancelación. No se simuló como prueba visual.
- Descartar no presenta destino antes de completar cierre, después navega una vez.
- Guardar éxito respeta el mismo límite.
- Volver durante cierre cancela navegación pendiente y conserva texto.
- Una intención posterior de ruta actual invalida el callback anterior.
- Unmount durante cierre no escribe una entrada tardía.
Resultado: 9/9 del archivo (4 del candidato +5 propias). Código y log preservados en focus-72459f5/independent-close-lifecycle.*. Estos tests no acreditan que todas las interacciones programáticas del fixture sean accesibles físicamente durante una animación.

## Regresión y artefactos
- Unit105/105; componentes57/57; types, lint, producto y harness build exit0.
- Discovery24E2E, sin ejecución browser cloud.
- Repro independiente same-origin blob ahora devuelve false; helper :7 exige request.protocol http explícito.
- Producto SHA256 ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343, idéntico2A.
- Harness SHA256 f9826fc0ccebc962205870161229e5b9b46aee6e9e51873052516918ac585bb4, nuevo por fix.
- Evidencia: focus-72459f5/ y contexto JSON; el implementador no fue modificado.

## Límites y siguiente gate
QA Mac debe ejecutar el escenario de foco reforzado y24casos file/HTTP sobre este hash final; la repetición y regresión2A corresponden a su reporte. Mantener por separado el bloqueo de Chromium cloud y el anterior fallo real de foco. Actualizar contrato/hashes antes de cualquier aprobación G2B. HISTORY01–09 e integración de producto permanecen abiertos según el plan; tampoco se declara aprobado un expediente del Design Skills Router.
