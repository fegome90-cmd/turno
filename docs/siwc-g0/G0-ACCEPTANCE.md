# G0 — Evidencia y criterios de aceptación

**Estado actual: `PREPARED / BLOCKED_BEFORE_G1`.** Este registro corresponde exclusivamente a la preparación de identidad y presentación pública de Turno, no a la aprobación de una integración OAuth.

| Requisito | Evidencia en el repositorio | Evaluación |
| --- | --- | --- |
| Identidad de producto | Nombre Turno, definición y límites en [APPLICANT-PROFILE.md](./APPLICANT-PROFILE.md) | PREPARADO |
| Descripción pública del propósito | [index.html](./index.html) | PREPARADO; publicación pendiente |
| Captura auténtica de interfaz | [assets/turno-capture-review-v6-synthetic.png](./assets/turno-capture-review-v6-synthetic.png), generada desde el frontend React v6 del PR #5 con datos sintéticos | VERIFICADA; NO RELEASE |
| URL pública de sitio propio | No se dispone de un origen HTTPS verificado | **BLOCKER** |
| Repositorio público | https://github.com/fegome90-cmd/turno | VERIFICADO |
| Responsable y entidad/titularidad | Campos pendientes en [APPLICANT-PROFILE.md](./APPLICANT-PROFILE.md) | **BLOCKER** |
| Email de contacto/soporte | No se inventó ni publicó información personal | **BLOCKER** |
| Aviso de privacidad aplicable | [privacy.html](./privacy.html), borrador no vigente | **BLOCKER** para publicación |
| Alcance sintético | Página, README del frontend React v6 y PR #5 declaran demo sintética y sin backend/LLM | VERIFICADO |
| Afiliación con OpenAI u hospitales | No se declara ninguna | VERIFICADO |
| OAuth/plan ChatGPT de usuarios | No instalado, autorizado ni promocionado como disponible | VERIFICADO |
| Solicitud de acceso OpenAI | No enviada | G1 PENDIENTE |

## Verificación ejecutada (Mac, 10-11-2026)

- Captura obtenida mediante Chrome headless desde el frontend React v6 del PR #5, usando exclusivamente los tres títulos sintéticos del brief. El build visual se ejecutó con Node 26.12.1, **fuera del rango Node 24 que declara ese paquete**; la captura acredita la interfaz mostrada, no sustituye las pruebas de producto en el motor soportado.
- Archivo PNG verificado: 1440 × 900; imagen visible con decodificación correcta en Chrome de escritorio (1440 px) y móvil (390 px).
- `node docs/siwc-g0/check-g0.mjs`: PASS; verificó rutas HTML locales, enlaces internos, ausencia de scripts/analítica en la página estática y estado de gate bloqueado. No hizo solicitudes de red.
- Chrome escritorio 1440×900 y móvil 390×844: sin errores JavaScript registrados, sin solicitudes externas y sin desbordamiento horizontal.
- `axe-core` sobre páginas `index.html` y `privacy.html` en viewport móvil: **0 infracciones automáticas WCAG 2 A/AA y 2.1 A/AA** tras corregir contrastes. El resultado no equivale a certificación integral de accesibilidad ni prueba con lector de pantalla.
- No se probó el sitio mediante HTTPS ni se ejercitó autenticación real; esos puntos siguen pendientes.

## Pendientes que requieren decisión del dueño

**Titularidad y contacto.** Determinar si el solicitante es una persona física o entidad jurídica, su nombre correcto y rol en el proyecto, y un correo de contacto verificable. No tomar datos del perfil personal del mantenedor sin aprobación.

**Publicación.** Escoger dominio/origen real para alojar `index.html` y `privacy.html`. Comprobar que el hosting entrega contenido por HTTPS, que los enlaces internos y la imagen funcionan, que no incorpora rastreadores no declarados y que existen vías de contacto.

**Privacidad.** Adaptar el aviso a los datos realmente tratados, alojamiento, cookies/logs, eventuales transferencias, plazos, ejercicio de derechos y responsables de soporte. Someterlo a revisión jurídica proporcional antes de hacerlo vigente. La Ley 21.719 entra en vigor el 1 de diciembre de 2026 según BCN.

**G1.** Solo después de cerrar los puntos anteriores revisar `APPLICANT-PROFILE.md`, rellenar el formulario oficial de interés y solicitar el criterio de OpenAI sobre la arquitectura web compartida con uso de plan individual. Ni la publicación de esta página ni el hecho de que Turno sea de código abierto conceden esa autorización.

## Criterio de salida de G0

`G0_PASS` **solo** cuando se verifiquen los siguientes cinco hechos: (1) identidad/titular real aprobada, (2) canal soporte accesible, (3) sitio propio HTTPS publicado con captura y repositorio, (4) aviso de privacidad actualizado y publicado, (5) versión de la ficha de solicitud coherente con lo publicado. Hasta entonces conservar `G0_PREPARED_NOT_SUBMISSION_READY`.

Referencias de validación: [OpenAI SIWC website](https://developers.openai.com/siwc/website); [SIWC terms](https://openai.com/policies/sign-in-with-chatgpt-terms/); [Ley Chile 21.719](https://www.bcn.cl/leychile/Navegar?idNorma=1209272).
