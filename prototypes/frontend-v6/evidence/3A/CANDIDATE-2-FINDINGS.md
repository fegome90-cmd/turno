# Corrida intermedia Chromium Mac candidate2

Los resultados intermedios se conservan, no son gates verdes del candidato final. Sin retries ni tolerancias aumentadas.

- 30 casos nuevos: 23 PASS / 7 FAIL. Regresión independiente: 59/60; HISTORY 44/44 y primitivas 11/11 PASS. Portable PASS. La suite agregada no se ejecutó sobre el candidato rojo.
- UI-18: el test usaba check(), cuya postcondición exige éxito checked=true, aunque el escenario fuerza fallo y exige false confirmado. Se cambia a click() con el mismo oráculo de restauración y puerto real.
- Disclosure: Lista 2 estaba legítimamente cubierta por el popover; no era un destino de click externo disponible. El nuevo caso usa Lista 1 no cubierta, retiene la referencia exacta del nodo y exige el toggle real tras cierre, sin force.
- El helper de navegación consultaba isVisible justo después de resize, antes del commit de React. Se espera el trigger visible según ancho y luego la visibilidad del drawer, sin sleeps nuevos.
- selectOption no enfoca por sí solo. El caso enfoca el selector antes del cambio para verificar conservación del foco, no una propiedad inexistente de la herramienta.
- El anillo se medía tras foco programático/puntero, no :focus-visible. Se usa Tab/Shift+Tab reales antes de la misma aserción exacta de 2px.
- Undo: el test editaba cuerpo y luego estimación, pero esperaba deshacer cuerpo. El probe nativo registró historyUndo sobre estimación (abc→ab): el stack seguía vivo. Editando cuerpo último antes de todos los cambios de ancho, Meta+Z actuó sobre cuerpo. Se prepara estimación primero, cuerpo último y se prueban ambos campos por separado, sin exigir agrupación de cadena dependiente de plataforma.
- Bug real separado: al ocultar columna Tiempo, el finalFocus explícito de Base UI robaba foco de un campo exterior. Se reprodujo RED y se restringe retorno al panel que realmente poseía foco; el estrechamiento transfiere al trigger sólo si ocultó su campo enfocado.
- Fidelidad: play cuadrado preexistente y punto canvas first-paint sobre sidebar se tratan como las excepciones acotadas del registro de ejecución, con sus RED intactos.

Los artefactos/trazas intermedios se guardaron por separado; un PASS de un subflujo no promueve la fase ni cierra identidades futuras.
