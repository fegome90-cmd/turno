# Turno — paquete G0 (antes de solicitar SIWC)

**Gate:** `G0_PREPARED_NOT_SUBMISSION_READY` · 2026-11-10

El objetivo de G0 es presentar Turno de manera verificable a OpenAI: identidad clara, propósito, alcance, evidencia visual, repositorio público y un marco de privacidad honesto. Este paquete se mantuvo separado del frontend React v6 y de las pruebas de modelos; no añade autenticación, APIs, almacenamiento, telemetría ni dependencias al producto.

## Archivos incluidos

| Archivo | Función | Estado |
| --- | --- | --- |
| [index.html](./index.html) + [styles.css](./styles.css) | Página de presentación responsiva, estática y sin tracking propio | Lista para revisión visual, **no publicada** |
| [assets/turno-capture-review-v6-synthetic.png](./assets/turno-capture-review-v6-synthetic.png) | Captura real de React v6 del [PR #5](https://github.com/fegome90-cmd/turno/pull/5), con tres tareas sintéticas | Evidencia técnica (no release) |
| [privacy.html](./privacy.html) | Aviso preliminar acorde al **estado actual**, sin fingir que hay usuarios | **BORRADOR** hasta definir responsable, contacto y hosting |
| [APPLICANT-PROFILE.md](./APPLICANT-PROFILE.md) | Identidad del producto, alcance en inglés para solicitud, campos pendientes de titular | Texto técnico preparado |
| [G0-ACCEPTANCE.md](./G0-ACCEPTANCE.md) | Matriz de cierre y decisiones sin resolver | Gate parcialmente cumplido |
| [check-g0.mjs](./check-g0.mjs) | Comprueba evidencia HTML, enlaces locales e imagen sin red ni dependencias | Ejecutable con Node 22+ |

## Verificación local

Desde la raíz del repositorio:

```sh
node docs/siwc-g0/check-g0.mjs
```

Para ver las páginas sin incorporar datos reales ni publicar: abrir `docs/siwc-g0/index.html` en el navegador o servir la carpeta desde un servidor estático temporal en `127.0.0.1`. La página no necesita `npm install`, JavaScript en cliente ni servicios externos para renderizar.

## Antes de solicitar acceso a OpenAI

1. Confirmar titular/persona responsable, entidad legal (si aplica), email de proyecto y soporte, **sin publicar información personal por suposición**.
2. Elegir hosting HTTPS real para esta página, publicar solo la versión revisada y verificar URL, captura y enlaces desde un navegador externo.
3. Completar la privacidad en función del proveedor y tratamientos efectivos. No usar el borrador como texto vigente. Verificar legislación aplicable, incluidas obligaciones de la Ley 21.719 desde 2026-12-01.
4. Revisar y aprobar la descripción en inglés de [APPLICANT-PROFILE.md](./APPLICANT-PROFILE.md). Solo después usar la URL **real** y enviar el formulario de interés a SIWC.

**No se envió ninguna solicitud y Turno no tiene aprobación SIWC.** El trabajo del proveedor de LLM y el frontend se encuentra en ramas separadas y no se modifica en G0.
