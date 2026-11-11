# Auditoría independiente del suplemento 2B

## Referencia
- HEAD revisado: 4234a8e8d4fad39e31d6aa9365a47b0f5f777f81.
- Árbol Git: 296553cb4b1df767c04b001c09dde9c917468dfb.
- Base runtime previamente revisada: 7b6d3e9dad978859a286384881bf3f05fc9cc25b.
- Copia propia: turno-2b-review. No se modificó el árbol del implementador.
- Diff desde 7b: sólo history.spec.ts, helper de política y tests unitarios del helper. Cero cambios src/manifest/lock.

## Hallazgo P2 limitado a política de pruebas
El helper acepta `blob:http://127.0.0.1:4182/id` para documento `http://127.0.0.1:4182/history-harness.html`. `new URL(blobUrl).origin` hereda el origen HTTP y el código sólo comprueba el protocolo del documento, no el de la solicitud.

Fuente: prototypes/frontend-v6/tests/e2e/support/history-request-policy.ts:7–8. La intención declarada es permitir sólo el documento file exacto o HTTP del servidor propio. El caso no acredita fuga de red ni defecto de producto, pero la afirmación sobre la allowlist no es exacta. Corrección propuesta: exigir request.protocol === 'http:' y prueba RED para blob del mismo origen.

Evidencia independiente: supplement-4234a8e/independent-policy-edges.log, 17/18 PASS y 1 FAIL. Se informó a Sol y al coordinador antes del cierre. No se editó código para obtener el resultado.

## Suplemento de carreras
- history.spec.ts:35–74 instrumenta únicamente entrega de listeners popstate; conserva history.go, estado y recorrido reales. El helper no pretende sustituir el browser ni acreditar tiempos no observados.
- :232–245 reproduce selección nueva durante replay aprobado, verifica ruta/título/idx y que Back restaure el origen visible.
- :248–255 reproduce selección antes de entrega de popstate del usuario, verifica que el evento viejo no sobrescriba la ruta nueva.
- Son compatibles con H1, previamente reproducido de forma independiente y corregido en 7b. El resto de escenarios continúa sin esta instrumentación.

## Control negativo de solicitudes
- :94–104 aplica la política a cada solicitud interceptada, registra y aborta rechazos.
- :122–133 exige rechazo de fetch, requestfailed, lista exacta de bloqueados y documento utilizable.
- :13–27 conserva mapas por Page y después de cada test exige cero errores; todos los casos excepto ese control siguen exigiendo cero solicitudes externas. El control no relaja globalmente el gate.

## Ejecución independiente
- Unit: 104/104 PASS; componentes: 56/56 PASS.
- Typecheck, lint, build de producto, build de harness: exit 0.
- Discovery E2E: 24 casos. No es ejecución.
- Producto SHA256: ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343.
- Harness SHA256: 958f133a58469020677cb1ba5b24c143f892f694b65132e2cdf3af774331fb19.
- Logs y contexto: supplement-4234a8e/. Browser cloud no se relanzó por bloqueo previamente confirmado. QA Mac está asignado de forma separada.

## Contrato y decisión
El contrato regenerado declara 4234a8e/24 casos y decisión STOP; su checker PASS es sólo de metadata/integridad. La primera lectura durante consolidación mostraba 4f88fca/22, ya corregido. Esto no constituye cierre G2B.

Suplemento de carreras adecuado. Mantener pendiente el pequeño ajuste de política y la evidencia browser final del SHA efectivo. No aprobar G2B ni integración 3A por estos resultados no visuales. Se mantienen los límites del Design Skills Router documentados en AUDIT-2B-7b6d3e9.md: referencia, no certificación visual/AT ni cierre ficticio de expediente.
