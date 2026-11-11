# Hoja de ruta del agente de fondo de Turno

Estado: borrador para aprobar. Fecha: 11 de noviembre de 2026.

Este documento ordena el trabajo del agente de fondo, desde lo que ya está verificado hasta la versión 2. Cada etapa tiene una condición de entrada y un criterio de término. Ninguna etapa usa datos reales antes de la revisión legal y de privacidad.

## Principios que no cambian

- **El agente propone; la persona decide.** Nunca guarda, completa, borra ni mueve tareas por su cuenta.
- **Sin decisiones clínicas.** Ante algo clínico, solo sugiere «revisar».
- **No sigue órdenes escritas dentro de una nota.**
- **Datos sintéticos** hasta que la revisión legal y de privacidad autorice otra cosa.
- **Métricas sin contenido:** solo contadores.
- **Sin secretos en el repositorio:** el escáner corre en el hook de pre-commit, en `npm test` y en el CI.
- **Cada pieza nueva se mide** con el mismo método de evaluación (set de prueba, set de control, latencia y costo) antes de activarla.

## Resumen

| Etapa | Qué entrega | Estado |
|---|---|---|
| 0 | Inferencia real verificada y modelo elegido | **Hecha** (PR #6, pendiente de integrar) |
| 1 | Definición v1 cerrada | En curso |
| 2 | Código del agente y endpoint integrados | Pendiente (requiere D1 y D2) |
| 3 | Agente v1 funcionando, con sus resguardos | Pendiente |
| 4 | Interfaz conectada al agente | Pendiente (requiere D3) |
| 5 | Piloto y fase `DUAL` | Pendiente (requiere revisión legal y de privacidad) |
| 6 | Fase `DECISION` | Pendiente |
| 7 | Versión 2 | Por definir |

## Etapa 0 — Inferencia real (hecha)

Entregado en el PR #6, rama `claude/eloquent-cerf-yg547a`:

- Vercel AI Gateway con `anthropic/claude-haiku-5.5` como modelo principal y `deepseek/deepseek-v4.1-flash` como respaldo.
- Decider `typesafe-ai/jev` con el interruptor `GATEWAY` / `DUAL` / `DECISION`, siguiendo el método de Strands y Amazon.
- Evaluación con 48 notas y 14 textos sintéticos: Haiku obtuvo 100 % en clasificación y captura, tanto en el set de prueba como en el de control.
- Resguardos contra secretos.

Detalle en [`../server/DECIDER.md`](../server/DECIDER.md).

**Para cerrarla:** que apruebes la integración del PR #6 (decisión D1).

## Etapa 1 — Definición v1

Qué hace el agente, para quién y qué no hace nunca.

Decidido en la sesión de preguntas:

| Tema | Decisión |
|---|---|
| Usuario | Solo quien hace el turno. La coordinación queda para v2 |
| Vocabulario | El agente dice «lista» y también entiende «cama» |
| F1. Captura de notas (con modelo) | Sugerencia automática en la bandeja, más un botón manual. Las notas marcadas «revisar» se sugieren con la etiqueta «revisa con cuidado», sin comentario clínico |
| F2. Avisos de revisión (reglas fijas) | Lista sin vincular, hora sin fecha, choque de horario en la misma lista y pendientes «antes del cierre» al cerrar el turno |
| F3. Atrasadas y próximas (reglas fijas) | «Próxima» = vence dentro de 15 minutos. Revisión cada 5 minutos. Valores fijos |
| F3: alcance | Solo el turno abierto |
| F3: tareas sin fecha | Usan la fecha del turno, y el aviso lo indica |
| Hora de inicio del turno | Se agrega. Una tarea sin fecha con hora anterior al inicio cae al día siguiente |
| Zona horaria | America/Santiago, configurable |
| Repetición de atrasadas | Cada 30 minutos, agrupadas, con «Posponer 30 min» y «No avisar más en este turno» |
| Cómo avisa | Bandeja silenciosa, más aviso en pantalla solo para lo urgente |
| Métricas | Solo contadores |
| Memoria | En v1, todo lo que el agente recuerda vive en los datos de la app: sugerencias descartadas, silencios, hora de inicio y zona horaria |

Pendiente (ronda 4 de preguntas):

- **Q13.** Cómo se pide la hora de inicio al abrir un turno.
- **Q14.** Si «Posponer» y «No avisar más» se guardan junto con el turno.
- **Q15.** Si F2 sigue sugiriendo «confirmar fecha» cuando F3 usa la fecha del turno.
- **Q16.** Qué acciones hay desde un aviso: solo «Abrir tarea», más posponer o silenciar.

**Término:** preguntas respondidas, entendimiento confirmado y `docs/agente-v1.md` en el repositorio.

## Etapa 2 — Integración del código

Condición de entrada: D1 y D2 decididas.

1. Integrar el PR #6 en `feature/opencode-secure-config`.
2. El PR #8 (endpoint `/v1/agent/events` con firma HMAC) queda solo con sus archivos propios. Pasa revisión y se integra con tu aprobación.
3. El PR #4 cambia su base a `main` (según D2), con los conflictos resueltos sin reescribir el historial.
4. Lo que te toca para cerrar el #4: revisar el presupuesto de la clave en Vercel (A-05) y correr `npm run smoke:live:keychain` en tu Mac.

**Término:** el agente y el endpoint están en `main` con el CI en verde.

## Etapa 3 — Agente v1 funcionando

Condición de entrada: etapas 1 y 2 terminadas.

**Funciones**

- F1 conectada al endpoint, en modo `GATEWAY`.
- F2 con las reglas fijas de `inspectDrafts`.
- F3 como evento periódico nuevo.
- Silencios y descartes según la definición v1.

**Piezas de Strands para v1**

| Pieza | Para qué |
|---|---|
| Autorización Cedar | Política fija: el agente no puede escribir, completar ni borrar tareas, aunque una nota lo pida |
| Intervención HITL | Toda acción propuesta espera la aprobación de una persona (modo pausa y reanudar, sin estado en el servidor) |
| ContextInjector | Pasar el estado del turno (hora local, hora de inicio, listas) en cada llamada, sin guardarlo en el historial |
| Telemetría (OpenTelemetry) | Contadores de sugerencias aceptadas y descartadas, latencia y costo, sin contenido |

Se agregan de a una, midiendo latencia y casos de inyección después de cada una.

**Término:**

- pruebas unitarias y de evaluación en verde, incluidos los intentos de inyección bloqueados por Cedar;
- captura con p95 ≤ 3 s;
- costo por turno registrado.

## Etapa 4 — Interfaz conectada

Condición de entrada: D3 decidida y etapa 3 terminada.

1. La interfaz del PR #5 pide las sugerencias a su backend, y el backend llama al endpoint. El navegador nunca habla directo con el agente.
2. Las reglas locales del #5 se reemplazan por las del agente, con un test que compruebe que dan el mismo resultado.
3. Bandeja, avisos urgentes agrupados, sin repeticiones, y los silencios de F3.
4. QA de interfaz: teclado, modo claro y oscuro, móvil y lector de pantalla.

**Término:** la bandeja muestra sugerencias que vienen del endpoint, con datos sintéticos y con las pruebas E2E en verde.

## Etapa 5 — Piloto y fase `DUAL`

Condición de entrada: revisión legal y de privacidad aprobada.

1. Piloto con uso real autorizado y metas iniciales:

   | Métrica | Meta |
   |---|---|
   | Sugerencias aceptadas | ≥ 60 % |
   | Avisos urgentes descartados como «no era urgente» | ≤ 10 % |
   | Tareas «antes del cierre» sin hacer al cerrar el turno | Menos que sin agente |

2. Activar `DUAL`: Jev y Haiku responden en paralelo y se registra cada desacuerdo.
3. Cliente MCP de solo lectura sobre el endpoint, con una lista de servidores permitidos.

**Término:** cada desacuerdo de `DUAL` revisado, y las metas ajustadas con los datos del piloto.

## Etapa 6 — Fase `DECISION`

Condición de entrada: revisión de desacuerdos de `DUAL` sin errores graves de Jev.

1. Jev clasifica solo. Haiku queda para la captura y para los casos con confianza baja.
2. Modelo de decisión y enrutamiento dentro de Strands, con respaldo a nivel del SDK además del Gateway.

**Término:** costo por nota menor que en `GATEWAY` (con los datos actuales, US$ 23 por millón de notas frente a 157), sin perder calidad en el set de control.

## Etapa 7 — Versión 2 (por definir)

Candidatos, a decidir con los datos del piloto:

- Vista de coordinación: resumen del equipo por turno.
- Resumen de entrega de turno (con `SummarizingConversationManager`).
- Preferencias de cada persona: primero como lista editable en la app; después, si hace falta, con `MemoryManager`, aprobación de la persona y sin contenido clínico.
- Steering para cargar las guías según el tipo de nota.
- Categoría de la tarea (Jev), limpieza de títulos, duplicados y sobrecarga de horario.

## Decisiones pendientes

| # | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Integrar el PR #6 en la rama del #4? | Sí: el CI está en verde y la revisión está cerrada |
| D2 | ¿Dónde vive el código del agente? | El #4 apunta a `main` |
| D3 | ¿Quién es dueño de las reglas fijas? | El agente; la interfaz las muestra a través del backend |
| D4 | ¿Dónde se guardan los resultados de evaluación? | En el repositorio solo los resúmenes; los JSON completos como artefacto del CI |

## Fuera de alcance

- Notificaciones fuera de la app (correo, SMS, push del sistema).
- Herramientas que dan acceso a la máquina o a internet (`shell`, `bash`, `python-repl`, `web-fetch`, `http-request`).
- Varios agentes trabajando juntos, hasta que v2 lo justifique.
