# Pila de avisos expandida · revisión v6

## Alcance

Continuación del frontend de demostración sobre `26ca71d81696750c1693e53cc73fc8c6b2dcbbf8`, sin modificar el backend ni el plugin oficial. Se conserva `prototypes/frontend-v5/` para mantener la continuidad de la carpeta. Esta iteración se guarda en una rama propia, no sustituye la rama v5.

El aviso único que reemplazaba el texto anterior pasa a una pila expandida propia en JavaScript/DOM. **No se instaló Sonner ni React.** El patrón es una adaptación pequeña para este prototipo sin dependencias de runtime, no una reproducción de todas las capacidades de Sonner.

## Decisiones y habilidades aplicadas

Fuentes públicas consultadas en `emilkowalski/skills`, commit `c8a79627b59d72d764d6ab6f2c87c09a48169833` (MIT):

- [animate](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animate/SKILL.md) y [RECIPES](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animate/RECIPES.md): propósito de feedback y continuidad espacial; transiciones de transform/opacity, entrada con `@starting-style`, salida hacia el mismo lado, cancelación y teclado sin movimiento. Se adapta la receta: 300 ms con el easing existente, no sus 400 ms/ease. La sensación resultante sigue pendiente de revisión visual.
- [ask-sonner](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/ask-sonner/SKILL.md) y [API](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/ask-sonner/API.md): un único contenedor persistente, mensajes identificados, cierre individual, pila expandida, atención al modal y safe areas. Se usa como referencia de diseño, no se invocan sus APIs.
- [pick-ui-library](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/pick-ui-library/SKILL.md): Sonner es la recomendación para un frontend React. Excepción explícita aquí: esta demo es vanilla y autónoma; añadir React solo para este componente sería una migración ajena al alcance.
- [animation-performance](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animation-performance/SKILL.md): se leen posiciones pintadas y destino por evento, con lecturas agrupadas antes de escribir transforms. No hay mediciones por frame ni animaciones de altura. Es una mejora estructural, no una medición de rendimiento.
- [review-animations / STANDARDS](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/review-animations/STANDARDS.md): se usa la lista de revisión de interrupción, propósito, propiedades y reducción de movimiento. No se adopta la recomendación genérica de acelerar superficies ya ajustadas.
- [improve-animations](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/improve-animations/SKILL.md): consultada para el reconocimiento y priorización. La implementación corresponde a la etapa `animate`, no se presenta una auditoría como si fuera implementación de todas las skills del repositorio.

No se aplicaron las 17 skills indiscriminadamente. No se añadieron gestos, efectos decorativos, resortes, bibliotecas de animación, nuevas pantallas ni cambios de marca.

Sonner se revisó como referencia, con [licencia MIT](https://github.com/emilkowalski/sonner/blob/8e4662b39255120b62138312058f5d77c0139a5e/LICENSE.md). No se copió su implementación. La licencia MIT de las skills permanece en `licenses/EmilKowalski-skills-MIT.txt`.

## Comportamiento

- Todos los avisos son persistentes hasta cierre individual o «Cerrar todos». No existe autocierre, temporizador de lectura, hover-pause ni desaparición de errores por timeout. Al recargar se pierde la sesión, igual que el resto del prototipo.
- Mensajes idénticos de igual severidad actualizan el mismo nodo y un contador. Un mensaje distinto no reemplaza al anterior. No hay un límite que expulse avisos silenciosamente: la lista tiene scroll y altura máxima de `min(40dvh, 420px)`; en ventanas bajas, `30dvh`.
- La lista ordena del más antiguo al más reciente. Al estar al final se muestra el nuevo aviso; al leer más arriba o tener foco en la lista se conserva la posición. Alt+T lleva al cierre del aviso más reciente, sin robar foco al llegar un mensaje.
- Cada cierre tiene nombre accesible y descripción asociada. Si se cierra el aviso enfocado, el foco pasa al siguiente o al anterior, y cuando no queda ninguno vuelve al contenido. Escape cierra solo el aviso enfocado. Los mensajes usan texto, nunca HTML interpretado.
- Hay regiones de anuncio persistentes separadas del listado visual: estado cortés y error urgente. Un duplicado añade el número de repeticiones para cambiar el anuncio. El orden y comportamiento real de anuncios con lectores de pantalla requieren QA real.
- Mientras hay un modal o drawer, la pila se suspende (`visibility:hidden`, `inert`, `aria-hidden`) y sus transiciones quedan desactivadas. Un mensaje generado entonces difiere su anuncio hasta cerrar el modal. Los errores del propio modal permanecen inline. No se intenta superar el top layer con z-index.
- La entrada y salida tienen 300 ms para puntero. La salida queda inert de inmediato y se retira al terminar su plazo; repetir el mensaje durante la salida cancela la retirada y retoma la misma tarjeta. FLIP conserva la posición pintada al reubicar vecinos y cancela frames obsoletos. No depende de un `transitionend` que podría no llegar.
- Teclado, reduced-motion y ausencia de rAF usan estados instantáneos. Activar movimiento reducido o pulsar una tecla asienta la pila y elimina salidas pendientes. Si `@starting-style` no está soportado, la entrada es instantánea y el contenido sigue disponible.
- Pantallas y diálogos siguen en 300 ms, drawers en 340 ms. No se acelera el inicio ni se cambia su identidad/estabilidad. Los cambios de campo y filtros no reciben animación adicional.

## Verificación y límites

Suite: Node.js + LinkeDOM. La revisión incluye regresiones de pila, duplicados, foco simulado, mensajes como texto, interrupción, cambio a teclado/reduced-motion, salida y reaparición, modal, conservación de scroll, reubicación de vecinos y validación sin borrar avisos anteriores. Se reconstruye el HTML autónomo y se ejecuta su smoke test.

**No se ejecutó un navegador ni QA visual en esta iteración.** No se afirma fluidez, contraste calculado en render, foco nativo, top-layer real, lector de pantalla, reflow real, comportamiento de teclado móvil ni rendimiento/GPU. La comprobación geométrica de FLIP usa rectángulos sintéticos y valida cálculos, no el resultado dibujado.

Antes de integrar: probar en navegador real a 390 y 1440 px, ventana baja, zoom 200 %, texto largo; revisar ráfagas y cierres de avisos al ralentizar animaciones; cerrar/reabrir el modal durante una transición; probar reduced-motion durante la animación, Tab/Shift+Tab/Alt+T/Escape y lector de pantalla. Confirmar especialmente que el ritmo de 300 ms se siente adecuado sin modificar las duraciones del inicio.
