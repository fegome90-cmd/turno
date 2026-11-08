# Frontera de demo, host y backend

**Estado: borrador de fase 0; integración NOT RUN.** No se inspeccionó ni modificó backend/host como parte de esta preparación. Fuentes: [PLAN](../PLAN.md), [PREFLIGHT](../PREFLIGHT.md) y [ADR-001](ADR-001.md).

## Dentro de la migración propuesta

- Demo local autónoma con perfil público Demo, datos sintéticos en memoria y puerto `TurnoPort` explícito. Sus métodos/nombres del plan son un contrato local propuesto, no una API del backend verificada.
- Adaptador de preview con latencia/error/conflicto controlados para tests. No representa autenticación, autorizaciones, sincronización ni exactitud de un servicio clínico.
- Un root React, ownership único del DOM y portales. Tema de sesión sin almacenamiento. Recarga inicia sesión de demo nueva.
- HTML embebido con fuentes/iconos/scripts del mismo build. G1A prueba shell offline; G7A completa edición/guardado. `file://` sin red y HTTP con servidor del documento disponible se reportan separados.

## Fuera del alcance

Backend/API real, login, identidad del usuario, persistencia o datos de pacientes; credenciales, facturación, cambios de seguridad, catálogo, despliegue o merge. No añadir Service Worker, flags ni caché persistente para aprobar offline. La indisponibilidad del backend no bloquea la demo aislada.

## Evidencia que todavía falta

| Capa | Resultado actual | Qué permitiría evaluarla |
|---|---|---|
| Contrato backend real | NOT RUN | Lectura autorizada de nombres/versiones y contrato vigente; no inventar endpoints ni modificar otro trabajo |
| Frontera local de adaptación | Solo propuesta | Interfaces y tests de demo en fases autorizadas; no acreditan host |
| Iframe local | NOT RUN | Ejecución en sandbox para aislamiento/portales; no demuestra CSP del host real |
| Host real | NOT RUN | Encargo específico y las cinco capas de evidencia H del PLAN: límites declarados allí, runtime y entorno reales |
| Producción/catálogo | Fuera de alcance | Autorización y revisión separadas, sin deducirlas de esta documentación |

Las cinco capas H del plan, para un encargo futuro autorizado, son:

1. Release/plugin, tool/resource URI/SDK y metadata/CSP/sandbox reales.
2. Contrato backend exacto, versiones, errores, idempotencia y autorización/owner.
3. Widget montado en ChatGPT real: viewport/fullscreen, eventos, foco, permisos, tema, assets y ausencia de filtración.
4. Persistencia y aislamiento multiusuario con datos sintéticos y entorno autorizado.
5. Avisos UI separados de recordatorios nativos, programación y push recibido.

Mantener reporte independiente: ni los tests de demo ni el bundle offline certifican esas capas. Sin evidencia, H sigue NOT RUN/BLOCKED aunque G0–G7 estén verdes. No compartir datos ni configurar accesos como parte de una lectura de contrato.
