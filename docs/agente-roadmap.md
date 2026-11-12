# Turno — Hoja de ruta maestra del agente de fondo

**Estado:** borrador maestro. **Fecha:** 11 de noviembre de 2026 (America/Santiago).
**Proyecto:** <https://github.com/fegome90-cmd/turno>

Este documento reemplaza a los dos anteriores:

1. «Hoja de ruta del agente de fondo de Turno» (11-11-2026), versión previa de este mismo archivo `docs/agente-roadmap.md`. Aportaba la visión por etapas 0–7, las decisiones de producto de la sesión de preguntas y las decisiones D1–D4.
2. «Turno — Roadmap ejecutable de inteligencia ambiental v1.1» (10-11-2026), `turno_roadmap_inteligencia_ambiental_v1_1_ejecucion.md`. Es un documento externo: no está en el repositorio y este archivo lo reemplaza. Aportaba los paquetes de ejecución G0, R1a, R0, R1b, R2, R3, R4, R5 y R6.

Es un plan. **Nada de lo que describe se ha ejecutado**, salvo la etapa 0 (PR #6, pendiente de integrar). No autoriza despliegues ni integraciones a `main`.

**Objetivo:** integrar en Turno mejoras ambientales pequeñas, medibles y silenciosas, sin chatbot, sin decisión clínica y sin volver a implementar la infraestructura Strands que ya existe.

---

## 1. Cómo usar este documento

El plan es incremental. Quien implementa ejecuta **un paquete o un parche a la vez**, registra evidencia y se detiene. No ejecuta todos los paquetes seguidos ni promueve código a `main`.

Cada paquete tiene seis partes:

| Parte | Qué es |
|---|---|
| `TASK` | Tareas con identificador (por ejemplo `R1a-T02`) |
| `VALIDATE` | Validación estática y funcional |
| `TEST` | Pruebas |
| `FIX` | Reparación acotada al defecto observado |
| `REPLAY` | Repetición del recorrido completo después de reparar |
| `REPLY` | Informe de cierre (plantilla en §23) |

**Estados de tarea:** `PENDING` · `IN_PROGRESS` · `PASS` · `BLOCKED` · `REJECTED`. Un paquete condicional puede estar además en `DEFERRED`. Todo parte en `PENDING`. Que una prueba exista no significa que se haya corrido.

**Ciclo por parche:**

1. Elegir una sola modificación observable. Guardar SHA base, archivos afectados y resultado esperado.
2. Escribir o ajustar una prueba de regresión que falle antes del cambio, cuando sea posible.
3. Aplicar el cambio mínimo. Ejecutar validaciones y pruebas focalizadas.
4. Si falla: reproducir, clasificar la causa (requisito, código, fixture o ambiente), reparar solo el defecto observado y repetir la prueba original.
5. Hacer `REPLAY` del recorrido completo que originó el problema (inicio → acción → consecuencia), con los casos vecinos y el baseline. Pasar una prueba unitaria no prueba que la experiencia de uso quedó bien.
6. Emitir `REPLY` y parar.

**STOP transversal.** Si una funcionalidad no aporta valor, requiere leer datos no autorizados, inventa información, rompe navegación o foco, o exige infraestructura nueva sin evidencia: se mantiene desactivada y se vuelve al enfoque convencional.

## 2. Principios y límites no negociables

1. **El agente propone; la persona decide.** El agente no guarda, completa, borra ni mueve tareas, ni cambia fechas, prioridades, listas o jornadas. Toda mutación pasa por el puerto de Turno con confirmación humana.
2. **Sin decisiones clínicas.** Ante algo clínico, como máximo sugiere «revisar» (ver C3).
3. **No sigue órdenes escritas dentro de una nota.**
4. **Sin datos reales ni identificables de pacientes. 100 % sintético hasta la revisión legal y de privacidad.** La etiqueta `synthetic: true` por sí sola no valida privacidad: la fuente debe estar controlada por el backend.
5. **El modelo no recibe herramientas de mutación.**
6. **Métricas sin contenido:** solo contadores. Nunca texto de notas, títulos ni datos identificables.
7. **Sin secretos en el repositorio.** El escáner corre en el hook de pre-commit, en `npm test` y en el CI. Las claves nunca van en el frontend ni en comandos o logs compartidos.
8. **Cada pieza nueva se mide antes de activarla,** con el mismo método: set de prueba, set de control, latencia y costo.
9. **Las sugerencias opcionales no generan alertas globales,** no roban foco y no se anuncian como error. Los errores reales de guardado sí pueden usar la pila de notificaciones. *(El aviso urgente de tareas atrasadas depende de C1.)*
10. **Sin polling,** memoria vectorial, agentes nuevos, dashboards de IA, resúmenes masivos ni rutas duplicadas de captura. *(«Sin polling» depende de C1.)*
11. **No se fusionan ramas completas,** no se instalan frameworks nuevos y no se despliega sin autorización separada. `main` no se asume como versión productiva.
12. **HMAC no es autorización de usuario.** La firma autentica al servicio; conectar datos reales exige un backend con autorización efectiva.

## 3. Política de tecnología

**Primero código, después mejor interacción, al final LLM.**

1. Verificar si el dato y la condición se pueden comprobar con código.
2. Si no basta, probar si una mejor interacción convencional evita el problema.
3. Solo si queda una necesidad real de comprender lenguaje libre entra un modelo. Jev clasifica etiquetas cerradas. Haiku extrae información semántica acotada.

Dos comparadores obligatorios para cualquier función con modelo:

- Gana solo si reduce **al menos 20 % la mediana de tiempo o de pasos** frente al flujo manual («seleccionar texto / crear tarea»), sin ruido, en una prueba sintética de uso. Se registra cuál de las dos métricas se usó.
- El costo se compara por **tarea útil finalmente aprobada**, no por token.

## 4. Baseline verificado

### 4.1 Ramas

SHA consultados el 10-11-2026 y confirmados vigentes el 11-11-2026.

| Ref | SHA | Contenido | Política |
|---|---|---|---|
| `main` | `dbb5824c41f15f4c911fa39da1b15ee09687913a` | React v6, Zustand, `TurnoPort`, tareas, notas, jornadas, notificaciones, demo sin persistencia | Base funcional y de regresión |
| `feature/turno-capture-review-ui-v6` | `82c6eedd731348b13846df14952487e6abed4648` | Interfaz de captura, tarjetas de revisión, reglas deterministas, `beforeClose`, pruebas | Seleccionar cambios. No traer el aviso global |
| `feat/internal-agent-http` (PR #8) | `c48376b0b0cbab29e59fea0924af771e2e350187` | Servicio Strands/Jev/Haiku, eventos, clasificación, extracción, HMAC de servicio, evaluación y pruebas | **Única** implementación principal del agente |
| `feature/turno-strands-gateway-v6` | `7ca56cd368da9cd9f44389f5205f04b7cd3deabd` | Segundo prototipo de reglas y filtros (`services/turno-agent`) | Referencia de pruebas y política. **No** es un segundo runtime |

Otras ramas y PR citados: PR #6 en `claude/eloquent-cerf-yg547a` (etapa 0), PR #4 en `feature/opencode-secure-config`, PR #5 (interfaz) en `feature/turno-capture-review-ui-v6`. La base del PR #5, `work/react-v6-ed374be`, ya está integrada en `main`.

Los SHA son una foto. Al iniciar cada paquete se vuelve a leer HEAD, se compara y se detiene el trabajo si cambió un contrato.

### 4.2 Hechos verificados en código

- `main`, `prototypes/frontend-v6/src/domain/validation.ts:35`, ya bloquea una hora sin fecha. No se agrega un aviso posterior por eso. En consecuencia, «una tarea sin fecha usa la fecha del turno» solo importa para borradores capturados.
- La rama de interfaz ya tiene `beforeClose` en `Task`, `EditDraft`, `EditorForm.tsx`, `createReviewedTask` y `CloseShiftDialog`. R2 refina y valida; no crea otra función.
- `AssistanceDialog.tsx` guarda tarjetas solo después de **Aprobar y guardar** y protege borradores. Tiene pruebas unitarias, de componente y E2E.
- La rama de interfaz contiene un aviso genérico automático en `App.tsx` cuando aparecen sugerencias nuevas. R1a lo elimina.
- El adaptador de `main` es memoria de demostración: no hay continuidad durable entre sesiones. R3 prueba la derivación desde el `Snapshot` de la sesión.
- `server/ambient-engine.mjs` responde a `note_saved` con un texto genérico cuando la etiqueta no es `NO_ACTION`. R5 lo estrecha.
- `server/http/server.mjs` acepta un esquema fijo de evento (`id`, `type`, `shiftId`, `synthetic`) y opera con fixtures. Conectar una entidad o versión real requiere un contrato explícito.
- `feat/internal-agent-http` **no contiene** los últimos commits del PR #6 (`4afaf40`, `3ad3acd`, `2f4fa93`). Le faltan:
  - el umbral del decider leído de la configuración en la evaluación (allí sigue fijo en 0,90; `server/decision-switch.mjs` conserva además `minConfidence = 0.90` como valor por defecto del parámetro). El PR #6 lo ajustó a 0 porque con 0,90 Jev se abstenía en respuestas correctas;
  - la clave validada del Gateway pasada de forma explícita con `createGateway`;
  - la redacción de secretos que conserva las banderas de cada expresión regular.

  Esto es la puerta G1 (§17), previa a R5.

## 5. Vista general

### 5.1 Etapas, paquetes y estado

Orden de ejecución de arriba hacia abajo. La etapa 1 corre en paralelo: no bloquea los paquetes sin modelo, salvo donde se indica.

| Etapa | Qué entrega | Paquetes | Condición de entrada | Estado |
|---|---|---|---|---|
| 0. Inferencia real | Modelo elegido y decider verificado | PR #6 | — | **Hecha**, pendiente de aprobar la integración (D1) |
| 1. Definición v1 | Alcance del agente cerrado | C1–C5, Q13–Q16, registradas en §6 de este documento | — | `PENDING` |
| 2. Interfaz silenciosa | Captura manual, tarjetas de revisión, avisos sin ruido | G0 → R1a → R0 → R1b | Árbol limpio y baseline corrido (G0) | `PENDING` |
| 3. Reglas sin modelo | Antes del cierre, continuidad, repeticiones | R2, R3, R4 | R0 y R1b en `PASS`. R4: evidencia de uso | `PENDING` (R4 `DEFERRED`) |
| 4. Integración del agente | Agente y endpoint alineados con el PR #6 | G1 | D1 y D2 decididas. Corre en paralelo con las etapas 2 y 3: no depende de ellas | `PENDING` |
| 5. Agente v1 con modelo | Nota → propuesta de tarea | R5 | R0 + R1a + R1b en `PASS`, G1 en `PASS`, C2–C4 decididas, solo fixtures sintéticos | `PENDING` (con puerta) |
| 6. Extensiones | Fechas en títulos, relaciones nota-tarea | R6 | R5 con valor demostrado | `DEFERRED` |
| 7. Piloto y fase `DUAL` | Uso real autorizado | — | Revisión legal y de privacidad aprobada | `PENDING` |
| 8. Fase `DECISION` | Jev clasifica solo | — | Desacuerdos de `DUAL` revisados sin errores graves de Jev | `PENDING` |
| 9. Versión 2 | Por definir | — | Datos del piloto | `PENDING` |

Equivalencia con las etapas del documento 1: sus etapas 0 y 1 son las mismas; su etapa 2 es la 4 de aquí; su etapa 3 es la 5; su etapa 4 (interfaz) se adelanta y se reparte en las 2 y 3 de aquí; sus etapas 5, 6 y 7 son las 7, 8 y 9.

Si C1 = A, se agrega un paquete nuevo para F3 (aún sin tareas definidas) después de R0. Ver §6.

### 5.2 Dependencias entre paquetes

```text
Interfaz (sin modelo)                              Agente (sin modelo)

G0 Baseline y contrato existente                   D1 + D2 decididas
       |                                                  |
       v                                                  v
R1a Parche de silencio en rama UI                  G1 PR #6 integrado y
       |                                              PR #8 actualizado
       v                                                  |
R0 Integración selectiva UI en candidato v6               |
       |                                                  |
       v                                                  |
R1b Identidad y caducidad                                 |
       |                                                  |
       +--------------------+                             |
       v                    v                             |
R2 Antes del cierre    R3 Continuidad                     |
                                                          |
R1b + G1 + C2-C4 decididas -------------------------------+
       |
       v
R5 Nota -> tarea
       |
       v
R6 Fechas/relaciones (solo tras medir)

R4 Duplicados exactos: condicional, después de R0 y R1b, solo si hay evidencia
```

El primer parche de código es **R1a**, en la rama aislada de interfaz. Así R0 no integra un aviso para quitarlo en el commit siguiente. R0 sigue siendo la puerta de integración. R1b se revisa después de R0. R2 y R3 no son condición de R5: se pueden hacer antes, después o en paralelo.

## 6. Decisiones de producto en conflicto (pendientes)

Los dos documentos de origen se contradicen en estos puntos. **Este documento no los decide.** La opción A viene de la sesión de preguntas (documento 1). La opción B viene del plan v1.1 (documento 2). Los paquetes que dependen de una elección lo indican con «depende de C#».

| # | Tema | Opción A (sesión de preguntas) | Opción B (plan v1.1) | Qué cambia en el plan según la elección |
|---|---|---|---|---|
| C1 | F3: tareas atrasadas y próximas | Revisión periódica cada 5 minutos. «Próxima» = vence dentro de 15 minutos. Aviso urgente en pantalla. Las atrasadas se repiten cada 30 minutos, agrupadas, con «Posponer 30 min» y «No avisar más en este turno». Solo el turno abierto. Valores fijos | Sin polling y sin alertas globales para sugerencias opcionales. F3 no existe | **A:** se agrega un paquete F3 nuevo después de R0, con sus propias tareas, pruebas y replay; los límites 9 y 10 de §2 necesitan una excepción explícita para el aviso urgente y para la revisión periódica; C5, Q13, Q14 y Q16 pasan a ser necesarias. **B:** no hay paquete F3; C5, Q13, Q14 y Q16 quedan sin efecto |
| C2 | Recordatorios | «Recuérdame a las 17:00» se convierte en una tarea con hora. F3 avisa | `PROPOSE_REMINDER` se abstiene: no hay sistema de alarmas | **A:** cambian R5-T03 y R5-T06 (la extracción puede llevar hora escrita en la nota) y el caso «recordatorio» del corpus de R5 pasa a esperar una propuesta; requiere C1 = A para que el aviso exista. **B:** R5 queda como está escrito |
| C3 | Notas que requieren revisión | Se sugiere la captura con la etiqueta «revisa con cuidado», sin comentario clínico | `NEEDS_REVIEW` se abstiene | **A:** cambia R5-T03, se agregan casos al corpus y la tarjeta necesita la etiqueta. **B:** R5 queda como está escrito |
| C4 | Experiencia de captura | Sugerencia automática en la bandeja más un botón manual. Varias tareas por nota | Una sola propuesta inline bajo la nota, una sola acción | **A:** cambian R5-T05 (más de una acción) y R5-T08 (bandeja en vez de inline); la sugerencia automática y el botón manual deben terminar en la misma tarjeta de revisión y en el mismo `createReviewedTask` que la captura manual del PR #5, o infringen el límite 10 (sin rutas duplicadas de captura); las expectativas actuales de `CAPTURE_CASES` (varias tareas por texto) se mantienen. **B:** R5 queda como está escrito y las expectativas de `CAPTURE_CASES` que piden varias tareas se revisan |
| C5 | Hora de inicio del turno y zona horaria | Se agrega la hora de inicio; una tarea sin fecha con hora anterior al inicio cae al día siguiente. Zona America/Santiago, configurable | No se necesitan | Solo hace falta si C1 = A. Con C1 = B no se implementa |

D3 (quién es dueño de las reglas fijas) también es un choque entre los dos documentos. Se trata en §7.

Decisiones del documento 1 que **no** entran en conflicto y se mantienen:

| Tema | Decisión |
|---|---|
| Usuario | Solo quien hace el turno. La coordinación queda para v2 |
| Vocabulario | El agente dice «lista» y también entiende «cama» |
| F2, avisos de revisión con reglas fijas | Lista sin vincular, hora sin fecha, choque de horario en la misma lista, pendientes «antes del cierre» al cerrar el turno. Cubiertos por R0, R1b y R2. «Hora sin fecha» ya está bloqueada en `main` para tareas normales; aplica a borradores capturados |
| Métricas | Solo contadores |
| Memoria | En v1, lo que el agente recuerda vive en los datos de la app. Hoy esos datos son el adaptador en memoria de la demo: los descartes duran la sesión (R1b-T02, R1b-T05) |

**Decididas el 12-11-2026 por la persona dueña:**

| # | Decisión | Efecto en el plan |
|---|---|---|
| C1 | **B:** F3 queda fuera de v1. Sin revisión periódica ni avisos globales | No hay paquete F3. Los límites 9 y 10 de §2 se mantienen sin excepción |
| C2 | **Se abstiene:** `PROPOSE_REMINDER` no produce propuesta | R5-T03 y R5-T06 quedan como están escritos; el caso «recordatorio» del corpus espera 0 propuestas |
| C3 | **Se abstiene:** `NEEDS_REVIEW` no produce propuesta | R5-T03 queda como está escrito |
| C4 | **Una propuesta inline** bajo la nota, una sola acción | R5-T05 y R5-T08 quedan como están escritos. Las expectativas de `CAPTURE_CASES` que piden varias tareas por texto se revisan en R5 |
| C5 | Sin efecto (depende de C1 = A) | No se implementa |

Preguntas de la ronda 4: Q13, Q14 y Q16 quedan sin efecto con C1 = B. Q15 se resuelve así: F2 sigue sugiriendo «confirmar fecha» en los borradores capturados.


Preguntas todavía abiertas de la ronda 4:

| # | Pregunta | Depende de |
|---|---|---|
| Q13 | Cómo se pide la hora de inicio al abrir un turno | C1 = A (vía C5). Sin efecto con C1 = B |
| Q14 | Si «Posponer» y «No avisar más» se guardan junto con el turno | C1 = A. Sin efecto con C1 = B |
| Q15 | Si F2 sigue sugiriendo «confirmar fecha» cuando F3 usa la fecha del turno | C1 = A. Con C1 = B, F2 sugiere confirmar fecha en borradores capturados sin más cambios |
| Q16 | Qué acciones hay desde un aviso: solo «Abrir tarea», o también posponer y silenciar | C1 = A para posponer y silenciar. «Abrir tarea» no depende de C1 |

**Término de la etapa 1:** C1–C5 y Q13–Q16 respondidas, entendimiento confirmado y las decisiones registradas en esta sección. No se crea otro documento: este es el único.

## 7. Decisiones pendientes

| # | Decisión | Recomendación del documento 1 | Nota |
|---|---|---|---|
| D1 | ¿Integrar el PR #6 en la rama del PR #4 (`feature/opencode-secure-config`)? | Sí: CI en verde y revisión cerrada | **Decidida el 11-11-2026: sí** |
| D2 | ¿Dónde vive el código del agente? | El PR #4 apunta a `main` | **Decidida el 11-11-2026: el agente va a `main` a través del PR #4** |
| D3 | ¿Quién es dueño de las reglas fijas? | El agente; la interfaz las muestra a través del backend | El plan v1.1 las deja en el frontend (R0-T04: `collectAmbientSuggestions` como regla pura sobre el `Snapshot`) y pide una sola política equivalente, no dos implementaciones (R1b). Sin resolver. No bloquea R1a–R3; sí define dónde quedan las reglas a partir de R5 |
| D4 | ¿Dónde se guardan los resultados de evaluación? | En el repositorio solo los resúmenes; los JSON completos como artefacto del CI | Conviene decidirla antes del `REPLY` de R5 |

## 8. Etapa 0 — Inferencia real (hecha)

Entregado en el PR #6, rama `claude/eloquent-cerf-yg547a`:

- Vercel AI Gateway con `anthropic/claude-haiku-5.5` como modelo principal y `deepseek/deepseek-v4.1-flash` como respaldo.
- Decider `typesafe-ai/jev` con el interruptor `GATEWAY` / `DUAL` / `DECISION`.
- Umbral del decider en 0, ajustado con los datos de `DUAL`: con 0,90 Jev se abstenía en respuestas correctas.
- Evaluación con 48 notas y 14 textos sintéticos (`server/eval/dataset.mjs`). Haiku obtuvo 100 % en clasificación y captura, en el set de prueba y en el de control.
- Resguardos contra secretos.

Detalle en [`../server/DECIDER.md`](../server/DECIDER.md).

**Para cerrarla:** aprobar la integración del PR #6 (D1). Esta evaluación es un antecedente: no prueba los casos de R5 ni valida datos reales.

## 9. Comandos de validación

Se usan solo cuando se ejecuta código y se registran en el `REPLY`. No se ejecutaron al redactar este documento.

**Frontend** (`prototypes/frontend-v6`; Node `>=24.15.0 <25`):

```bash
node --version
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:component
npm run test:e2e          # ejecuta pretest:e2e / build:e2e
npm run check:portable    # sobre dist/preview.html ya compilado: correr después de test:e2e o de npm run build
```

Prueba focalizada: `npx vitest run --project unit <ruta>` o `--project component <ruta>`. Si el entorno no tiene Playwright/Chromium o no puede instalar paquetes, se reporta `BLOCKED` con la razón exacta; el E2E no se marca `PASS`. `npm run test:smoke:engines` es complementario y requiere Firefox y WebKit.

**Agente** (`server/`; Node `>=22`):

```bash
node --version
npm ci --ignore-scripts
npm run check
npm test
npm run check:secrets
npm run demo
npm run smoke:preflight
```

La inferencia facturable (`smoke:live:*`, `eval:live`) **no** se ejecuta automáticamente. Requiere un entorno controlado con credencial privada, presupuesto y aprobación de esa prueba. Su resultado se registra aparte de las pruebas offline.

**Replay obligatorio por parche:** prueba focalizada → pruebas relacionadas → suites completas de la superficie tocada → escenario E2E en escritorio y móvil → comprobación de que no hay llamadas a modelos en los paquetes deterministas. Se guardan comandos, salida real, ambiente y SHA, no solo un «PASS» declarado.

## 10. G0 — Preflight documental y de entorno

Antes del primer parche. No permite refactorizaciones.

- [ ] **G0-T01** Registrar `git status --short`, rama actual, SHA de `main` y SHA de la rama de interfaz. Verificar que el árbol está limpio o aislar cambios ajenos. Si un SHA difiere del baseline (§4.1), revisar su diff antes de tocar archivos.
- [ ] **G0-T02** Correr el baseline del frontend en la rama elegida (`typecheck`, `lint`, unitarias, componentes y E2E disponibles) **antes del cambio**. Guardar número exacto de pruebas, ambiente y bloqueos. No afirmar que una suite está en verde por resultados históricos.
- [ ] **G0-T03** Confirmar que la primera tarea cambia solo `App.tsx` y las pruebas del aviso global, sin datos clínicos ni claves.
- [ ] **G0-T04** Registrar objetivo y STOP: una sugerencia aparece en el acceso voluntario, nunca como aviso automático; los errores reales se siguen anunciando.

| Parte | Contenido |
|---|---|
| VALIDATE | Diff y contratos de `App.tsx` y `NotificationStack`; Node conforme a `package.json`; fixtures sintéticos |
| TEST | Baseline existente |
| FIX | Solo defectos de ambiente reproducibles, o registrar `BLOCKED` |
| REPLAY | Escenario de captura con la experiencia actual, como comparación previa |
| REPLY | SHA, baseline observado y decisión `READY` o `BLOCKED` para R1a |

## 11. R1a — Eliminar el aviso global de sugerencia (primer parche)

**Resultado visible:** la persona sigue trabajando; el hallazgo queda en «Sugerencias» sin aviso genérico. **LLM: 0.**
**Base:** `feature/turno-capture-review-ui-v6`, en rama aislada de prueba.
**Archivos:** `prototypes/frontend-v6/src/app/App.tsx` y `tests/component/assistance.test.tsx` (o un caso nuevo en ese archivo). No se toca `NotificationStack.tsx` ni `server/`.
**No depende de C1:** el aviso que se elimina es el genérico de «hay una nueva sugerencia», que ninguna de las dos opciones conserva.

### TASK

- [ ] **R1a-T01** Tomar el SHA de HEAD y ubicar el `useEffect` que compara `previousSuggestionIds` y ejecuta `session.notifications.notify('Hay una nueva sugerencia…')`.
- [ ] **R1a-T02** Escribir la prueba de no-notificación: guardar dos tareas sintéticas en una misma lista y horario confirmado; se produce la sugerencia `shared-slot`, pero `notifications.items` no aumenta por el hallazgo ambiental.
- [ ] **R1a-T03** Retirar solo el efecto de anuncio general y los imports o refs que queden sin uso. Mantener `collectAmbientSuggestions`, `visibleSuggestions`, el contador y el botón que abre el panel.
- [ ] **R1a-T04** Verificar que los errores de guardado conservan su notificación de error. No silenciar errores de dominio.

### VALIDATE / TEST

- Typecheck, lint, `tests/unit/ambient-review.test.ts`, `tests/component/assistance.test.tsx`.
- `tests/e2e/assistance.spec.ts` en escritorio y móvil: dos tareas con la misma fecha, hora y lista → el acceso voluntario funciona y no hay aviso ambiental; el diálogo editable, el descarte y el foco siguen correctos.
- Contraprueba: fallo simulado del puerto → aviso de error visible y accesible.

### FIX / REPLAY / REPLY

- **FIX permitido:** imports muertos, aserción de prueba o ubicación incorrecta del efecto. No reescribir el store de notificaciones.
- **REPLAY:** crear A → crear B → confirmar horario compartido → seguir escribiendo sin interrupción → abrir «Sugerencias» → revisar o descartar → provocar un error de guardado y confirmar que se informa.
- **REPLY:** `R1a PASS` solo si ambos comportamientos (silencio ambiental y aviso de error) están demostrados. Dejar un commit o parche pequeño y **STOP**.

## 12. R0 — Consolidar la interfaz sin fusionar arquitecturas

**Resultado visible:** candidato React v6 con captura manual y tarjetas de aprobación, sin modelo ni cambios de backend. **LLM: 0.**
**Base:** candidata derivada de `main`, con el parche R1a verificado.
**Archivos posibles:** `src/domain/types.ts`, `src/adapters/turno-port.ts`, `src/adapters/preview-adapter.ts`, `src/app/store.ts`, `src/app/App.tsx`, `src/components/AssistanceDialog.tsx`, `src/components/OverlayCoordinator.tsx`, `src/components/AppShell.tsx`, `src/ambient/review.ts`, `src/styles/assistance.css`, pruebas `ambient-review` y `assistance`.

### TASK

- [ ] **R0-T01** Revalidar HEAD y merge-base de `main` y de la rama de interfaz. Inventariar solo los cambios de captura y revisión. No traer cambios no relacionados.
- [ ] **R0-T02** Integrar tipos y puerto de creación revisada con validación **atómica**: `ReviewedTaskInput`, `createReviewedTask`, `beforeClose` y la garantía de no guardar sin aprobación.
- [ ] **R0-T03** Incorporar la interfaz de captura y sugerencias con la navegación y el foco existentes. Integrar la corrección R1a; no recuperar la notificación descartada.
- [ ] **R0-T04** Reutilizar `collectAmbientSuggestions` como regla pura sobre el `Snapshot` del frontend. Sin nueva fuente de verdad ni store paralelo. *(La ubicación definitiva de las reglas depende de D3.)*
- [ ] **R0-T05** Documentar que los cambios viven en el adaptador de memoria y que el contrato de backend persistente sigue pendiente. **No** incorporar `server/` todavía mediante un merge global.

### VALIDATE / TEST

- Contrato: ningún intento inválido crea tareas; la hora requiere fecha; `beforeClose` excluye fecha y hora en el flujo revisado; los ID de listas pertenecen a la jornada activa; los borradores sobreviven al cierre accidental del diálogo.
- Suites completas del frontend (§9), incluidas `tests/component/shift-lifecycle.test.tsx`, `navigation.test.tsx`, `assistance.test.tsx`, `tests/e2e/assistance.spec.ts`, `overlays.spec.ts` y `responsive.spec.ts`.
- Escritorio (1440×900) y móvil (390×844), claro y oscuro, teclado y foco devuelto. No afirmar Safari físico a partir de Chromium emulado.

### FIX / REPLAY / REPLY

- **FIX permitido:** conflictos entre `TurnoPort`, tipos, stores o control de overlays; una sola causa por parche. No sustituir toda la navegación ni recrear componentes.
- **REPLAY:** abrir turno → crear tarea → editar → guardar → completar → abrir captura → revisar 2 tarjetas → guardar una con fecha válida → descartar la otra → archivar jornada → abrir el archivo en solo lectura → abrir una jornada nueva. Comparar con el baseline sin captura.
- **REPLY:** distinguir funciones ya existentes de las incorporadas, pruebas realmente ejecutadas, conflictos resueltos, SHA y cualquier puerta `BLOCKED`. Sin promoción automática a `main`.

## 13. R1b — Caducidad y deduplicación sin sistema nuevo

**Resultado:** una sugerencia no reaparece porque React renderizó, porque la misma tarea se guardó de nuevo o porque la inferencia respondió tarde. **LLM: 0 en reglas y presentación.**
**Base:** R0 integrado.
**Superficies:** `src/ambient/review.ts`, estado de descartes en `App.tsx`, prueba de componente. En la futura integración semántica se reutiliza la política equivalente del motor del servidor, no una segunda implementación.

### TASK

- [ ] **R1b-T01** Definir la identidad por tipo de problema + entidades + **versión o firma del hecho**, no por render ni por evento. Ejemplo: `shared-slot|shiftId|bedId|date|time|sortedTaskIds`.
- [ ] **R1b-T02** Descarte de sesión: una sugerencia descartada no vuelve mientras el hecho sea el mismo. Un cambio material (lista, fecha, completitud) permite evaluarla otra vez.
- [ ] **R1b-T03** Invalidar sugerencias si desaparece la condición, cambia la jornada, se completa la tarea o el contexto ya no es navegable.
- [ ] **R1b-T04** Mantener las sugerencias ordinarias fuera de la pila de avisos y sin foco automático. Si hay que conservar una sugerencia diferida, reutilizar el panel existente.
- [ ] **R1b-T05** Usar retroalimentación mínima en pruebas: `shown`, `reviewed`, `dismissed`, `accepted`, `expired`. Sin texto libre y sin persistencia por ahora.

### VALIDATE / TEST

- Mismo snapshot con 20 renders y 3 guardados idénticos → un único hallazgo visible; descartar → 0; cambiar la condición → caduca; cerrar la jornada → 0 en la jornada activa.
- `tests/unit/ambient-review.test.ts` y una prueba de componente para identidad y descartes. E2E: el aviso no invade el modal ni el foco.
- No usar un cooldown temporal como única deduplicación. El filtro de 60 segundos de `services/turno-agent/src/suggestion-gate.mjs` es referencia, no garantía de experiencia.

### FIX / REPLAY / REPLY

- **FIX:** ajustar la clave de identidad o la caducidad antes de crear persistencia nueva. No construir un gestor global de sugerencias.
- **REPLAY:** crear A y B → ver 1 sugerencia → descartar → navegar → volver → guardar A sin alterar el hecho → sigue descartada → cambiar A a otra hora → desaparece la anterior → recrear una coincidencia material nueva → aparece como hallazgo nuevo.
- **REPLY:** `repeticiones visibles`, `descartes respetados` y `eventos inválidos silenciados`, con los números observados en las pruebas.

## 14. R2 — Pendiente explícito antes del cierre

**Resultado:** en el diálogo de cierre, la persona identifica y abre la tarea concreta marcada `beforeClose`, sin bloqueos ni avisos extra. **LLM: 0.**
**Reutilizar:** `Task.beforeClose`, `EditDraft.beforeClose`, la casilla de `EditorForm.tsx`, `collectAmbientSuggestions` y el contador `beforeClose` de `CloseShiftDialog`. No recrear estas piezas.

### TASK

- [ ] **R2-T01** Releer los componentes integrados. Confirmar que la casilla, la persistencia, el contador y la ausencia de horarios inventados sobreviven a R0.
- [ ] **R2-T02** Sustituir o complementar el número anónimo con un enlace **«Revisar pendiente»** cuando hay exactamente una tarea, o con una lista breve de enlaces cuando hay más. Si abre la tarea, cerrar el diálogo respetando el retorno de foco y la navegación existente.
- [ ] **R2-T03** Mantener **«Cerrar y archivar»** disponible aunque la tarea siga pendiente. La advertencia no presume que deba completarse.
- [ ] **R2-T04** No enviar `shift_close_attempt` a modelos para este caso. Usar el snapshot ya confirmado.

### VALIDATE / TEST

- 0 pendientes `beforeClose`: sin línea especial. 1: muestra título y enlace correcto. 2: contador o lista precisos. Al completar uno, baja el recuento. Se puede cerrar igual y los pendientes quedan archivados.
- Cambio de la casilla en el editor normal; combinación inválida `beforeClose` + fecha u hora al capturar; bloqueo de cambios en el archivo; sin doble aviso; **0 invocaciones de modelo**.
- Pruebas unitarias y de componentes de cierre, y `tests/e2e/shift-lifecycle.spec.ts`. Teclado en móvil y escritorio, con retorno de foco al navegar desde el modal.

### FIX / REPLAY / REPLY

- **FIX:** si el enlace altera overlays o foco, repararlo en el punto de navegación; no introducir otro modal. Si no hay lugar claro para el enlace, conservar el contador y dejar la mejora del enlace como diferida.
- **REPLAY:** tarea marcada → intentar cerrar → revisar la tarea → completar o dejar pendiente → intentar cerrar de nuevo → confirmar el archivo → comprobar solo lectura y conservación del estado.
- **REPLY:** `número correcto / enlace correcto / cierre no bloqueado / 0 LLM`, con evidencia de foco y pruebas ejecutadas.

## 15. R3 — Continuidad entre jornadas por datos estructurados

**Resultado:** al abrir una jornada nueva, una fila pasiva da acceso rápido a los pendientes previos. **LLM: 0.**
**Reutilizar:** `Snapshot.shifts`, `tasks`, `shiftId`, `completed`, `src/navigation/use-product-navigation.ts` y la vista `archive`. No se resumen notas ni se leen correos.

### TASK

- [ ] **R3-T01** Agregar el selector puro `getPriorPending(snapshot, activeShiftId)`: tareas incompletas de turnos `closed` distintos del activo, con orden explícito y seguro.
- [ ] **R3-T02** Mostrar «De jornadas anteriores · N pendientes» como fila pasiva en la navegación cuando hay jornada activa y pendientes previos.
- [ ] **R3-T03** La acción `Revisar` abre el archivo y la tarea de origen, **en solo lectura**. Visitar la fila no crea ni copia tareas.
- [ ] **R3-T04** Resolver qué significa «anterior»: `Shift` tiene `date` pero no `closedAt`. No afirmar que una jornada es la inmediatamente anterior si dos cierres comparten fecha. En el piloto: etiqueta plural «De jornadas anteriores», sin orden causal inferido.
- [ ] **R3-T05** No prometer continuidad entre recargas: la demo usa un adaptador en memoria. La persistencia llega solo cuando exista el puerto autorizado definitivo.

### VALIDATE / TEST

- 0 pendientes previos → fila ausente; 1 → acceso; varios turnos con la misma fecha → orden no engañoso; todos completos → ausente; sin turno activo → no atribuir pendientes a una jornada nueva; el archivo sigue en solo lectura.
- Pruebas puras sobre fixtures, pruebas de navegación e historial, y E2E en escritorio y móvil. Verificar que las tareas no se copian ni mutan y que el modelo recibe **0 eventos**.

### FIX / REPLAY / REPLY

- **FIX:** si «turno anterior» es ambiguo, cambiar el texto a «jornadas anteriores» y usar ID estables. No agregar `closedAt`, una base de datos ni un cron por este defecto.
- **REPLAY:** crear y dejar un pendiente en el turno A → cerrar A → abrir B → ver N → entrar a A archivado → volver a B → completar la tarea solo cuando la persona lo haga por una vía autorizada (el archivo sigue en solo lectura) → volver a mirar N. Probar la recarga por separado y reportar la pérdida de estado esperada de la demo.
- **REPLY:** tiempo y pasos de acceso desde B hasta el pendiente de A frente a la navegación por archivo; 0 LLM; 0 escrituras automáticas. No extrapolar persistencia.

## 16. R4 — Repeticiones exactas (paquete condicional)

**Estado por defecto:** `DEFERRED`. **LLM: 0.**
**Entrada:** evidencia de que las personas repiten tareas sin querer (observación, pruebas de uso o fixtures representativos). **Si no hay evidencia, se queda en `DEFERRED`.** No se marca `BLOCKED`.

### TASK

- [ ] **R4-T01** Definir equivalencia **exacta normalizada** (espacios, mayúsculas y minúsculas Unicode, título, misma jornada y misma lista). Sin coincidencia difusa ni embeddings.
- [ ] **R4-T02** Evaluar al confirmar la creación o revisión, **no en cada tecla**. Si existe, ofrecer «Abrir existente» y «Crear igualmente».
- [ ] **R4-T03** No marcar registros como duplicados automáticamente: dos tareas idénticas pueden ser legítimas.
- [ ] **R4-T04** Medir cuántas veces se abre la existente y cuántas se crea igualmente. No almacenar el cuerpo de las tareas para estas métricas.

### VALIDATE / TEST

- Coincidencia en la misma lista y turno → ayuda; misma cadena en otra lista o turno → silencio; tildes o palabras distintas → no inferir equivalencia; tarea ya completada → comportamiento explícito; la creación legítima repetida siempre se permite.
- Pruebas unitarias de normalización y de componente de creación; E2E de «Crear igualmente». 0 llamadas a modelos.

### FIX / REPLAY / REPLY

- **FIX:** si hay demasiados falsos positivos, restringir a coincidencia binaria exacta. No agregar modelos.
- **REPLAY:** crear «Revisar inventario» → intentar una segunda igual en la misma lista → abrir la existente → intentar de nuevo y elegir «Crear igualmente» → comprobar dos registros independientes.
- **REPLY:** ganancia observada y decisión `KEEP` (se conserva) o `DEFERRED` (se retira y vuelve al estado por defecto). No continuar por sofisticación.

## 17. G1 — PR #6 integrado y PR #8 actualizado (puerta previa a R5)

Puerta nueva de este documento. Reúne la etapa 2 del documento 1 y el hecho verificado en §4.2. **Entrada:** D1 y D2 decididas. No depende de los paquetes de interfaz: puede correr en paralelo con ellos. **LLM: 0** (solo pruebas offline).

- [ ] **G1-T01** Integrar el PR #6 en `feature/opencode-secure-config`, con aprobación (D1).
- [ ] **G1-T02** Actualizar el PR #8 (`feat/internal-agent-http`, endpoint `/v1/agent/events` con firma HMAC) sobre el PR #6. Debe quedar solo con sus archivos propios. Pasa revisión y se integra con aprobación.
- [ ] **G1-T03** Volver a verificar en el PR #8 actualizado: umbral del decider en 0 leído de la configuración (también en la evaluación), clave validada del Gateway pasada con `createGateway`, y redacción de secretos que conserva las banderas de las expresiones regulares.
- [ ] **G1-T04** Cambiar la base del PR #4 a `main` (según D2), resolviendo conflictos sin reescribir el historial.

| Parte | Contenido |
|---|---|
| VALIDATE | Diff del PR #8 contra el PR #6: solo archivos del endpoint. Releer SHA y registrar los nuevos |
| TEST | Comandos del agente (§9), offline. Sin inferencia facturable |
| FIX | Solo conflictos de la actualización; una causa por parche |
| REPLAY | `npm run demo` y `npm run smoke:preflight` sobre el PR #8 actualizado |
| REPLY | SHA nuevos, las tres verificaciones de G1-T03 con evidencia, estado del CI |

**Término:** el agente y el endpoint están en `main` con el CI en verde, y G1-T03 está demostrado.

**Fuera de G1, tareas de la persona dueña para cerrar el PR #4:** revisar el presupuesto de la clave en Vercel (A-05) y correr `npm run smoke:live:keychain` en su Mac. Esta última es inferencia facturable: se aprueba aparte y su resultado se registra separado de las pruebas offline. No bloquea R5.

## 18. R5 — Primer experimento donde un modelo sí aporta valor

**Resultado:** después de guardar una nota sintética con un compromiso claro, una única sugerencia inline propone una tarea concreta con trazabilidad; la persona decide revisarla o descartarla. *(Forma de la sugerencia: depende de C4.)*
**LLM:** Jev para la etiqueta cerrada y Haiku para la extracción, **solo** después de los filtros. Sin modo `DUAL` permanente.
**Puerta de entrada:** R0, R1a y R1b en `PASS`; el flujo de revisión funciona sin IA; G1 en `PASS`; C2, C3 y C4 decididas; entorno del agente autenticado con **fixtures sintéticos exclusivamente**. La demo pública o un cliente sin backend autorizado **no** llama al proveedor.
**Arquitectura:** el navegador nunca habla directo con el agente. La interfaz pide las sugerencias a su backend y el backend llama al endpoint.

### TASK — Dominio, orquestación y privacidad

- [ ] **R5-T01** Definir el contrato `note_saved` posterior al guardado, con ID, versión confirmada y `shiftId`. El servidor obtiene el contenido desde un snapshot autorizado. El esquema HTTP actual es exacto: se modifica deliberadamente y se prueban HMAC, autorización y compatibilidad. No se aceptan textos arbitrarios desde el navegador.
- [ ] **R5-T02** Filtros deterministas previos: nota vacía, más de 500 caracteres, sin contexto autorizado, vista o turno inválidos, mismo hash o versión ya procesado, etiqueta `TODO:` inequívoca que se resuelve sin modelo (comparar con la acción manual), contenido no sintético → abortar o procesar localmente según el caso.
- [ ] **R5-T03** En `server/ambient-engine.mjs`, solo `PROPOSE_TASK` puede pedir extracción. `NO_ACTION` se abstiene siempre. `PROPOSE_REMINDER` se abstiene *(depende de C2)*. `NEEDS_REVIEW` se abstiene *(depende de C3)*.
- [ ] **R5-T04** En `server/decision-switch.mjs`, conservar a Jev como clasificador acotado. Costo y latencia por clasificación y tasa de abstención son métricas. La confianza numérica no se trata como probabilidad calibrada.
- [ ] **R5-T05** En `server/gateway-capture.mjs` y `capture-review.mjs`, extraer **una** acción útil con `title`, ancla al fragmento fuente y referencia a `noteId` y `version` (en el sobre confiable; no se obedecen órdenes del texto). Si hay cero, más de una contradictoria o ninguna con respaldo: silencio. *(Una o varias acciones: depende de C4.)*
- [ ] **R5-T06** Validar campos: título corto; sin inventar fecha, hora, prioridad, completitud ni lista. El título se puede editar en la tarjeta existente. Sin `saveTask` entre las herramientas de Strands y sin escritura en la respuesta. *(Hora escrita en un recordatorio: depende de C2.)*
- [x] **R5-T07** Comparar con las tareas existentes por regla fija antes de mostrar (desde R5c: regla por palabras de contenido, ver §27). No pedir a Haiku que resuelva equivalencia difusa en el primer experimento.

### TASK — Interacción y límites de ejecución

- [ ] **R5-T08** Mostrar la propuesta **inline** bajo la nota seleccionada: «¿Agregar “Solicitar etiquetas de despacho” a tareas?», con `Revisar tarea` y `Descartar`. Nunca aviso ni diálogo automático. *(Inline o bandeja con botón manual: depende de C4.)*
- [ ] **R5-T09** `Revisar tarea` abre la **misma tarjeta existente** de captura y revisión, editable y con aprobación explícita. `Descartar` suprime esa versión. Sin persistencia ni telemetría de textos libres.
- [ ] **R5-T10** Respuesta tardía: comprobar versión actual, nota seleccionada y contexto antes de pintar. Si la persona editó o salió, descartar sin reintentar ni avisar. Mantener la cancelación y el timeout de Strands y fallar cerrado.
- [ ] **R5-T11** Instrumentar en pruebas `eligible`, `jev_called`, `haiku_called`, `shown`, `reviewed`, `accepted`, `edited`, `dismissed`, `expired`, `tokens_in/out`, `estimated_cost`, `duration_ms`, **sin texto de nota, títulos ni datos identificables**.

### VALIDATE / TEST — Corpus sintético

**Se reutiliza `server/eval/dataset.mjs`** (48 notas de clasificación y 14 textos de captura, todos sintéticos). No se crea un corpus paralelo. De los 18 casos de la tabla siguiente, solo se agregan los que el dataset no cubre. Como mínimo son nuevos: tarea ya presente, respuesta de versión obsoleta y entrada fuera de la fuente autorizada. Los demás se toman de los grupos existentes (`task`, `no_action`, `ambiguous`, `reminder`, `injection`, `clinical_like` y `long`) después de revisar su cobertura caso a caso.

| Grupo | Casos | Resultado esperado |
|---|---:|---|
| Compromiso claro no registrado | 6 | ≥ 5 títulos útiles y correctos; propuesta editable, nunca guardada sola |
| Notas descriptivas o tareas ya realizadas | 4 | 0 propuestas |
| Condicionales o insuficientemente definidas | 2 | 0 propuestas |
| Tarea ya presente exactamente | 2 | 0 propuestas duplicadas |
| Recordatorio explícito | 1 | 0 propuestas que prometan alarma *(depende de C2)* |
| Inyección de instrucciones dentro de la nota | 1 | Ninguna instrucción ejecutada y ninguna mutación |
| Respuesta de versión obsoleta | 1 | 0 propuestas visibles |
| Entrada fuera de la fuente sintética autorizada | 1 | Rechazo **antes** de llamar al modelo |
| **Total** | **18** | Baseline de decisión, no cifra de aprobación de producto |

Además:

- Escenario de interfaz de punta a punta: editar nota → guardar confirmado → observar la propuesta → revisar el título → aprobar → comprobar 1 sola tarea. Repetir descartando → 0 escrituras.
- Prueba negativa con `NO_ACTION`, `NEEDS_REVIEW`, `PROPOSE_REMINDER` y error de API: todos se silencian *(los dos del medio dependen de C3 y C2)*.
- Simular latencia y edición concurrente. No se presentan propuestas obsoletas.
- Meta heredada del documento 1: captura con p95 ≤ 3 s y costo por turno registrado.

**Comparadores obligatorios:** los de §3 (20 % frente al flujo manual; costo por tarea útil aprobada). La evaluación de la etapa 0 es antecedente, no prueba de estos casos.

### FIX / REPLAY / REPLY

- **FIX:** si hay sugerencias genéricas, corregir el contrato de extracción y las condiciones de abstención. Si un modelo produce fecha o prioridad inventada, bloquear la salida en el validador antes de tocar prompts. Un fallo observado por iteración; no rediseñar el SDK.
- **REPLAY:** repetir el caso que falló con el **mismo fixture**, la misma versión de prompt y modelo y los mismos parámetros. Después repetir negativos, concurrentes y toda la ruta de interfaz. Conservar registros sin contenido sensible y el costo de la corrida. Un fix no se cierra por mejorar solo el caso de desarrollo: se agrega un caso de control sintético.
- **REPLY:** tabla de los 18 casos, tasas, número exacto de llamadas a Jev y Haiku, casos con abstención, p50 y p95, tokens y costo medido, tiempo frente al flujo manual, defectos y fixes, y decisión `KEEP` / `REJECT` / `HOLD`. **NO GO** si hay cualquier escritura automática, salida sin respaldo o dato no autorizado.

## 19. R6 — Extensiones, solo si R5 demuestra valor

**Estado por defecto:** `DEFERRED`. No empieza automáticamente después de R5.

### TASK

- [ ] **R6-T01** Fechas escritas de forma explícita en títulos: medir primero la frecuencia. Evaluar un parser determinista de fechas inequívocas según formato y localización. Ofrecer confirmación visible; no programar en silencio.
- [ ] **R6-T02** Relaciones nota-tarea más complejas: reunir casos sintéticos donde no bastó el enlace de origen ni la coincidencia exacta. Probar una clasificación limitada solo si evita pasos reales.
- [ ] **R6-T03** Evaluar contra el baseline convencional (búsqueda, enlaces, filtros). Sin embeddings ni índice semántico persistente por defecto.

### VALIDATE / TEST / FIX / REPLAY / REPLY

- Fecha ambigua, referencia relativa o cambio de año: **no inferir**. Coincidencia semántica insuficiente: abstención. Nunca unir tareas automáticamente.
- Si el parser convencional cubre los casos con menor error, se rechaza la versión con modelo. Si aporta valor, se abre un parche **nuevo** con su set de pruebas; R5 no se amplía hacia atrás.
- **REPLY:** evidencia de frecuencia y de ahorro o errores; decisión `NO_BUILD`, `RULE_ONLY` o `LLM_EXPERIMENT`, con justificación concreta. Sin evidencia: `NO_BUILD`.

## 20. Piezas de Strands

El modelo no recibe herramientas de mutación (§2). Eso cambia la prioridad de las piezas que el documento 1 proponía para v1. No se agregan piezas fuera de esta lista.

| Pieza | Situación | Motivo |
|---|---|---|
| Contadores propios (R5-T11) | Corto plazo | Sugerencias aceptadas y descartadas, llamadas, latencia y costo, registrados con código propio y sin dependencias nuevas. Solo contadores, sin contenido |
| Telemetría de Strands (OpenTelemetry) | Requiere autorización | El SDK declara los paquetes de OpenTelemetry como dependencias opcionales, y hoy solo está instalado `@opentelemetry/api`. Usarla exige instalar exportadores y el SDK de OTel, que el límite 11 no permite sin autorización separada |
| ContextInjector | Opcional | Pasar el estado del turno en cada llamada sin guardarlo en el historial. Solo si R5 lo necesita |
| Autorización Cedar | Condicional | Solo es relevante si el agente llega a tener herramientas |
| Intervención HITL | Condicional | Igual que Cedar. Sin herramientas, la aprobación humana ya ocurre en la tarjeta de revisión |
| MemoryManager | Candidato a v2 | Preferencias por persona |
| SummarizingConversationManager | Candidato a v2 | Resumen de entrega de turno |
| Steering | Candidato a v2 | Guías según el tipo de nota |

Cada pieza que se agregue va de a una, midiendo latencia y casos de inyección después.

## 21. Etapas posteriores

### 21.1 Etapa 7 — Piloto y fase `DUAL`

**Entrada:** revisión legal y de privacidad aprobada. Hasta entonces, todo es sintético.

1. Piloto con uso real autorizado y metas iniciales:

   | Métrica | Meta |
   |---|---|
   | Sugerencias aceptadas | ≥ 60 % |
   | Avisos urgentes descartados como «no era urgente» | ≤ 10 % *(solo si C1 = A)* |
   | Tareas «antes del cierre» sin hacer al cerrar el turno | Menos que sin agente |

2. Activar `DUAL`: Jev y Haiku responden en paralelo y se registra cada desacuerdo.
3. Cliente MCP de solo lectura sobre el endpoint, con lista de servidores permitidos. Es infraestructura nueva: se somete al STOP transversal (§1).

**Término:** cada desacuerdo de `DUAL` revisado y las metas ajustadas con los datos del piloto.

### 21.2 Etapa 8 — Fase `DECISION`

**Entrada:** revisión de desacuerdos de `DUAL` sin errores graves de Jev.

1. Jev clasifica solo. Haiku queda para la captura. Pasar a Haiku cuando Jev tiene confianza baja sería una función nueva: hoy el modo `DECISION` se abstiene en ese caso, y con umbral 0 no ocurre.
2. Modelo de decisión y enrutamiento dentro de Strands, con respaldo a nivel del SDK además del Gateway.

**Término:** costo por nota menor que en `GATEWAY` (con los datos actuales, US$ 23 por millón de notas frente a 157), sin perder calidad en el set de control.

### 21.3 Etapa 9 — Versión 2 (por definir)

Candidatos, a decidir con los datos del piloto:

- Vista de coordinación: resumen del equipo por turno.
- Resumen de entrega de turno (`SummarizingConversationManager`).
- Preferencias de cada persona: primero como lista editable en la app; después, si hace falta, con `MemoryManager`, aprobación de la persona y sin contenido clínico.
- Steering para cargar guías según el tipo de nota.
- Categoría de la tarea (Jev), limpieza de títulos, duplicados y sobrecarga de horario.

## 22. Matriz transversal de pruebas y procedimiento FIX → REPLAY

Aplica a cada cambio afectado.

| Dimensión | Escenario crítico | Puerta |
|---|---|---|
| Dominio | Fechas, listas, turnos, estado `completed`, `beforeClose` | Ninguna escritura inválida ni parcial |
| Propuestas | Detección repetida, descarte, caducidad, versión obsoleta | 0 avisos redundantes; 0 sugerencias obsoletas |
| Interacción | Teclado, foco, lectores de pantalla, modal existente | Ningún foco robado; `aria-live` no anuncia opcionales como errores |
| Responsive | Escritorio 1440×900 y móvil 390×844; claro y oscuro | Acción accesible sin scroll ni overlay roto |
| Historial | Navegación, archivo y regreso al editor | Borradores protegidos; archivo en solo lectura |
| Riesgo IA | Texto no sintético, inyección, respuesta inválida, timeout | Rechazar o abstenerse; 0 escrituras |
| Economía | Llamadas reales por evento y tipo | 0 LLM en G0–R4 y G1; R5 solo después de la puerta semántica. Las pruebas en vivo de la persona dueña (§17) se aprueban y registran aparte |
| Ambiente | Node requerido, instalación, pruebas de navegador | Bloqueos reportados de forma explícita; ningún `PASS` inferido |

Procedimiento para cualquier paquete:

```text
FAIL observado -> identificador del caso y evidencia reproducible
  -> hipótesis mínima de causa
  -> 1 cambio limitado
  -> repetir EXACTAMENTE el caso fallido
  -> repetir vecinos/negativos
  -> suite de superficie y E2E
  -> inspeccionar diff (sin cambios ajenos)
  -> REPLY con veredicto / STOP
```

Sin reintentos infinitos. No se acumulan cinco fixes sin releer. No se declara promoción por aprobar un subconjunto. Un fallo de infraestructura queda `BLOCKED`; una regresión funcional es `FAIL`.

## 23. Plantilla de REPLY y bitácora

Una respuesta por parche, corta y verificable:

```markdown
### REPLY — Turno Ambient | <paquete>/<task> | <fecha>
Estado: PASS / BLOCKED / REJECTED
Base -> HEAD: <sha_base> -> <sha_actual>
Cambio: <1–3 frases: qué cambió y qué NO cambió>
Archivos: <paths exactos>
VALIDATE: <comando y resultado, o NO_EJECUTADO/BLOCKED>
TEST: <prueba focalizada y suites, resultado numérico real>
FIX: <issue reproducible -> arreglo exacto; o ninguno>
REPLAY: <pasos ejecutados, resultado observando UI/estado>
LLM: <0 llamadas o Jev=N, Haiku=N, costo; solo si medido>
Riesgos/pendientes: <defecto restante o ninguno>
Veredicto: <GO a revisión / STOP / NO_GO>
Acción siguiente: <una sola, sin promoción implícita>
```

**Bitácora (nada ejecutado todavía):**

| Paquete | Estado | Evidencia para marcar `PASS` |
|---|---|---|
| Etapa 0 — inferencia real | Hecha, pendiente de integrar (D1) | PR #6 aprobado e integrado |
| G0 — preflight | `PASS` (11-11-2026, ver §27) | SHA, baseline corrido, decisión `READY` |
| R1a — eliminar aviso global | `PASS` (11-11-2026, ver §27; integrado en la rama del PR #5, `4603785`) | Pruebas focalizadas, E2E, error conservado, diff mínimo |
| R0 — integración de interfaz | `PASS` (11-11-2026, ver §27; PR #5 con base `main`) | Tipos y puerto, suites completas, replay de captura y archivo |
| R1b — identidad y caducidad | `PASS` (12-11-2026, ver §27; integrado en la rama del PR #5, `335aa97`) | Deduplicación, descarte y caducidad en pruebas y en la interfaz |
| R2 — antes del cierre | `PENDING` | Enlace correcto, cierre no bloqueado, solo código |
| R3 — continuidad | `PENDING` | Pendientes accesibles sin transferencias ni modelo |
| R4 — repetición exacta | `DEFERRED` | Evidencia de frecuencia antes de ejecutar |
| G1 — PR #6 y PR #8 | `PASS` (11-11-2026, ver §27) | PR #8 sobre PR #6, tres verificaciones de G1-T03, CI en verde |
| R5 — nota semántica | `PASS` — decisión `KEEP` (12-11-2026, ver §27): R5a, R5b y R5c en `PASS` | 18 casos, comparación con el flujo manual, autorización sintética |
| R6 — extensiones | `DEFERRED` | Valor demostrado y baseline convencional insuficiente |
| Paquete F3 | No se crea (C1 = B, decidida el 12-11-2026) | — |
| Etapas 7, 8 y 9 | `PENDING` | Ver §21 |

## 24. Primer paquete listo para implementar: R1a

Después de G0. Trabajar sobre `feature/turno-capture-review-ui-v6` en una rama aislada de prueba, inspeccionar el SHA y ejecutar **solo R1a-T01 a R1a-T04**. La condición se observa en la interfaz y en las pruebas de `assistance`, no en texto inventado de logs. No conectar Strands, no cambiar `NotificationStack`, no modificar datos ni servicios, no fusionar a `main`. Después de prueba, fix si hace falta, replay y `REPLY`: **STOP**.

**Condición final:** guardar tareas que generan una sugerencia no presenta aviso genérico; el botón y el contador de «Sugerencias» siguen funcionando; los errores auténticos se siguen anunciando. Si Playwright no puede ejecutarse, el replay visual queda `BLOCKED` y el parche no se da por validado de forma integral.

## 25. Fuera de alcance

- Notificaciones fuera de la app (correo, SMS, push del sistema).
- Herramientas que dan acceso a la máquina o a internet (`shell`, `bash`, `python-repl`, `web-fetch`, `http-request`).
- Varios agentes trabajando juntos, hasta que v2 lo justifique.
- Chatbot, memoria vectorial, dashboards de IA y resúmenes masivos.
- Datos reales o identificables de pacientes antes de la revisión legal y de privacidad.

## 26. Referencias de código

- `main` — <https://github.com/fegome90-cmd/turno/tree/main/prototypes/frontend-v6>
- `AssistanceDialog` — <https://github.com/fegome90-cmd/turno/blob/feature/turno-capture-review-ui-v6/prototypes/frontend-v6/src/components/AssistanceDialog.tsx>
- `App.tsx` (aviso automático en la rama de interfaz) — <https://github.com/fegome90-cmd/turno/blob/feature/turno-capture-review-ui-v6/prototypes/frontend-v6/src/app/App.tsx>
- `ambient/review.ts` y `beforeClose` — <https://github.com/fegome90-cmd/turno/blob/feature/turno-capture-review-ui-v6/prototypes/frontend-v6/src/ambient/review.ts>
- E2E de captura — <https://github.com/fegome90-cmd/turno/blob/feature/turno-capture-review-ui-v6/prototypes/frontend-v6/tests/e2e/assistance.spec.ts>
- `ambient-engine.mjs` — <https://github.com/fegome90-cmd/turno/blob/feat/internal-agent-http/server/ambient-engine.mjs>
- Extractor Strands — <https://github.com/fegome90-cmd/turno/blob/feat/internal-agent-http/server/gateway-capture.mjs>
- Decider, modelos y costos — [`../server/DECIDER.md`](../server/DECIDER.md)
- Transporte interno y limitaciones — <https://github.com/fegome90-cmd/turno/blob/feat/internal-agent-http/server/ENDPOINT.md>
- Dataset de evaluación — `server/eval/dataset.mjs`

## 27. Registro de ejecución

### REPLY — Turno Ambient | G0/T01–T04 | 11-11-2026

```markdown
Estado: PASS
Base -> HEAD: 82c6eedd731348b13846df14952487e6abed4648 (feature/turno-capture-review-ui-v6) -> sin cambios
Cambio: ninguno. G0 no cambia código; no hubo commits en la rama de interfaz.
Archivos: ninguno modificado.
VALIDATE: origin/main = dbb5824c41f15f4c911fa39da1b15ee09687913a y rama de interfaz = 82c6eed, iguales a §4.1. Copias de trabajo limpias antes y después.
TEST: Node v24.22.2, npm ci, typecheck, lint, unitarias 165/165 (12 archivos), componentes 322/322 (21 archivos), E2E Chromium 231/231 (incluye build), check:portable PASS (0 errores de consola o de página, 0 peticiones externas). Corrido dos veces en copias separadas (worker y tester): mismos números, sin pruebas inestables.
FIX: ninguno.
REPLAY: no aplica (sin cambios). Alcance de R1a leído en código: App.tsx:47 declara previousSuggestionIds, el useEffect está en 48-56 y la llamada notify('Hay una nueva sugerencia de organización para revisar.', 'status') en la línea 52. Ninguna prueba afirma hoy que ese aviso aparece; assistance.test.tsx no tiene una aserción sobre él, así que R1a-T02 la agrega.
LLM: 0 llamadas.
Riesgos/pendientes: check:portable necesita dist/ compilado (correr después de test:e2e o de npm run build). Firefox y WebKit no se corrieron (fuera de G0). El ambiente del sandbox trae Node 22; se usó Node 24.22.2 instalado aparte.
Veredicto: GO a revisión. Decisión para R1a: READY.
Acción siguiente: R1a, con aprobación.
```

### REPLY — Turno Ambient | R1a/T01–T04 | 11-11-2026

```markdown
Estado: PASS
Base -> HEAD: 82c6eedd731348b13846df14952487e6abed4648 -> 4603785 (integrado en feature/turno-capture-review-ui-v6, PR #5)
Cambio: se quitó solo el useEffect que anunciaba «Hay una nueva sugerencia de organización para revisar.», su ref y el import useEffect sin uso. No cambian collectAmbientSuggestions, visibleSuggestions, el contador, el botón «Sugerencias», NotificationStack, el store de avisos ni server/.
Archivos: prototypes/frontend-v6/src/app/App.tsx; prototypes/frontend-v6/tests/component/assistance.test.tsx (+32/-11).
VALIDATE: typecheck y lint sin errores; diff limitado a los dos archivos.
TEST: prueba nueva de horario compartido sin aviso: FAIL en 82c6eed, PASS en el cambio (reproducido por worker y tester). Contraprueba de error al guardar: PASS antes y después. Unitarias 165/165, componentes 324/324 (322 + 2), E2E 231/231, check:portable PASS. Corrido dos veces en copias separadas, con los mismos números.
FIX: ninguno.
REPLAY: Chromium, 1440×900 y 390×844, sobre la build compilada. Crear A y B en la misma lista, fecha y hora → sin aviso de sugerencia (antes del cambio aparecía al cerrar el diálogo) → «Sugerencias» muestra «Tareas en el mismo horario» → «Descartar» la quita. Error de guardado simulado («Simular fallo» de la demo) → el error se ve en el diálogo y el aviso «No se pudo completar» aparece al cerrarlo. Capturas guardadas fuera del repositorio.
LLM: 0 llamadas.
Riesgos/pendientes: el foco después de guardar queda igual que antes del cambio (contenedor del modal); no se comprobó con lector de pantalla. No hay un E2E nuevo para el escenario de horario compartido. El commit se integró en la rama del PR #5 por decisión de la persona dueña.
Veredicto: GO a revisión.
Acción siguiente: R0, con aprobación.
```

### REPLY — Turno Ambient | G1/T01–T04 | 11-11-2026

```markdown
Estado: PASS
Base -> HEAD: feature/opencode-secure-config 44d7099 -> a55b405
Cambio: T01, PR #6 integrado (f3f6b92). T02, PR #8 actualizado sobre el PR #6 (67f92ed, cbbb02c) e integrado con aprobación (a55b405). T04, main unido a la rama del PR #4 (9e30cd0) y base del PR #4 cambiada a main. Sin reescribir historial; nada integrado a main.
Archivos: solo merges. Único conflicto: .gitignore (add/add), resuelto conservando las reglas de las dos ramas.
VALIDATE: T03 en el PR #8: la evaluación lee el umbral del decider de la configuración; el decider pasa la clave validada con createGateway; la redacción de secretos conserva las banderas de cada patrón.
TEST: escáner de secretos, npm run check, servidor 78/78 (120/120 con el endpoint), demo, smoke:preflight (OFFLINE_CHECKS_ONLY), frontend v5 212/212 y check_portable. CI `tests` en verde en cada head; Vercel turno-v5 y turno-v6 listos en el PR #4.
FIX: ninguno.
REPLAY: no aplica (integración sin cambios de comportamiento).
LLM: 0 llamadas.
Riesgos/pendientes: A-05 (presupuesto de la clave en Vercel) y npm run smoke:live:keychain en el Mac de la persona dueña, para cerrar el PR #4. La descripción del PR #4 está desactualizada.
Veredicto: GO a revisión.
Acción siguiente: R1b.
```

### REPLY — Turno Ambient | R0/T01–T05 | 11-11-2026

```markdown
Estado: PASS
Base -> HEAD: main dbb5824 -> feature/turno-capture-review-ui-v6 74d8b41 (PR #5, base cambiada a main)
Cambio: el candidato es la rama del PR #5 sobre main: 30 commits, 20 archivos de captura y revisión (+682/-18), sin cambios ajenos. La casilla «antes del cierre» del editor normal pertenece a la función y la reutiliza R2. Único commit nuevo: docs/ambient-ui-v6.md actualizado (base main, R1a, check:portable, orden de typecheck).
Archivos: docs/ambient-ui-v6.md.
VALIDATE: contrato con evidencia en código: ReviewedTaskInput y createReviewedTask atómico, hora exige fecha, «antes del cierre» excluye fecha y hora, lista del turno activo, nada se guarda sin «Aprobar y guardar». collectAmbientSuggestions es puro sobre el Snapshot; sin store paralelo; R1a presente.
TEST: lint, typecheck, unitarias 165/165, componentes 324/324, E2E 231/231, check:portable PASS, en dos instalaciones separadas (worker y tester). Un fallo TS7016 del worker se reprodujo como carrera con npm ci todavía instalando; no es un defecto del repositorio.
FIX: ninguno en código.
REPLAY: recorrido de 14 pasos (abrir turno, crear, editar, guardar, completar, capturar 2 tarjetas, guardar una, descartar otra, archivar, abrir archivo en solo lectura, abrir jornada nueva) en 1440×900 y 390×844, claro y oscuro: 56/56 pasos sin errores de página ni peticiones externas; repetido por el tester en 1440×900 oscuro con el mismo resultado.
LLM: 0 llamadas.
Riesgos/pendientes: sin prueba del editor normal con «antes del cierre» y fecha u hora (el código lo rechaza; lo cubre R2), de una lista de un turno cerrado (el código lo rechaza) ni de un borrador al cerrar el diálogo por fuera y reabrirlo. Firefox y WebKit no se probaron. No se comparó contra un baseline sin captura.
Veredicto: GO a revisión.
Acción siguiente: R1b.
```

### REPLY — Turno Ambient | R1b/T01–T04 | 12-11-2026

```markdown
Estado: PASS
Base -> HEAD: feature/turno-capture-review-ui-v6 74d8b41 -> 335aa97 (PR #5)
Cambio: un descarte dura solo mientras exista el mismo hecho. Cuando la sugerencia desaparece de collectAmbientSuggestions, su descarte se olvida; si la coincidencia se recrea, vuelve a mostrarse como hallazgo nuevo. Ajuste de estado durante el render, sin efecto, sin store nuevo, sin persistencia ni temporizadores. La identidad por hecho (T01) ya existía en review.ts y no cambió.
Archivos: prototypes/frontend-v6/src/app/App.tsx (+8); tests/unit/ambient-review.test.ts (+28); tests/component/assistance.test.tsx (+70).
VALIDATE: typecheck y lint sin errores. Análisis del patrón: no hay bucle, y los descartes no se borran por recargas porque load reemplaza el snapshot de forma atómica.
TEST: prueba nueva «recrear la misma coincidencia» FAIL antes del cambio y PASS después (worker y tester). Unitarias 167/167, componentes 328/328, E2E 231/231, check:portable PASS, con los mismos números en dos instalaciones.
FIX: ninguno.
REPLAY: Chromium, 1440×900 y 390×844: crear A y B en el mismo horario → 1 sugerencia → descartar → navegar y volver → sigue descartada → guardar A sin cambiar el hecho → sigue descartada → mover A a otra hora → desaparece → devolverla → vuelve a aparecer. Sin el cambio, el último paso falla en los dos anchos. Sin «nueva sugerencia» ni peticiones externas.
LLM: 0 llamadas.
Riesgos/pendientes: T05 (retroalimentación shown/dismissed/expired) no se implementó, sin telemetría nueva. Dos cambios agrupados en un mismo render (ir y volver de hora) conservan el descarte. Firefox, WebKit y lector de pantalla no se probaron.
Veredicto: GO a revisión.
Acción siguiente: R5, con su puerta (G1, R0, R1a y R1b en PASS; C2–C4 decididas).
```

### REPLY — Turno Ambient | R5a (servidor) y R5b (interfaz) | 12-11-2026

```markdown
Estado: PASS (sin inferencia real; R5c pendiente)
Base -> HEAD: servidor 47516ca -> 1eee902 (PR #4); interfaz 335aa97 -> 38c6e8e (PR #5)
Cambio: R5a: note_saved lleva noteId y noteVersion; el servidor lee la nota del snapshot autorizado. Filtros fijos antes del modelo (nota inexistente o desactualizada, vacía, más de 500 caracteres, ya procesada). Solo PROPOSE_TASK pasa a extraer una única acción (C2–C4). El título debe citar un fragmento exacto de la nota (8 caracteres o más) y no lleva fecha, hora ni día relativo; una tarea abierta con el mismo título la bloquea. Un registro de métricas por nota, solo contadores. R5b: la propuesta aparece debajo de la nota guardada con «Revisar tarea» y «Descartar»; «Revisar tarea» abre la tarjeta de revisión existente con solo el título; se descarta en silencio si la nota cambió, se eligió otra o pasaron 20 s. La demo no tiene fuente de propuestas.
Archivos: server/ (ambient-engine, note-proposal, prompts, http/server, http/snapshots, live-background, ENDPOINT.md, README.md y pruebas); prototypes/frontend-v6/ (note-proposals, use-note-proposal, NoteProposal, EditorForm, AssistanceDialog, App, create-session, editor.css y pruebas); docs/ambient-ui-v6.md.
VALIDATE: revisión adversaria de worker y tester: la nota llega al modelo como datos JSON con instrucciones fijas; ninguna ruta de abstención llama al extractor; el navegador nunca envía el texto; sin fetch nuevo en la interfaz.
TEST: servidor 120 -> 166/166, sin fallos intermitentes en dos corridas; interfaz unitarias 167 -> 173, componentes 328 -> 346, E2E 231/231, check:portable PASS. Pruebas nuevas en FAIL sobre el código anterior.
FIX: escenario «recordatorio» de la prueba en vivo alineado con C2; cita mínima de 8 caracteres; «15h», «hoy», «mañana» y días de la semana rechazados en el título; fuente que lanza o no devuelve promesa queda en silencio; la interfaz revalida cada propuesta antes de mostrarla.
REPLAY: servidor real con peticiones firmadas y modelos simulados: propuesta, 401 por repetición, ya procesada, desactualizada, NEEDS_REVIEW y PROPOSE_REMINDER se abstienen, duplicado, 400 si el cuerpo trae texto. Demo en Chromium (1440×900 y 390×844): al guardar una nota no aparece propuesta y no sale ninguna petición.
LLM: 0 llamadas reales.
Riesgos/pendientes: R5c (18 casos en vivo con Jev y Haiku, costo por tarea aprobada y comparación del 20 % con el flujo manual) requiere autorización de gasto. La versión de nota procesada se recuerda 601 s por proceso. Si el clasificador falla, esa versión no se reintenta en ese lapso.
Veredicto: GO a revisión.
Acción siguiente: R5c, con autorización.
```

### REPLY — Turno Ambient | R5c (evaluación en vivo) y decisión R5 | 12-11-2026

```markdown
Estado: PASS — decisión R5: KEEP
Base -> HEAD: 56d89da -> 134289a (PR #4, servidor)
Cambio: primera corrida en vivo (DECISION, 18 casos, 24 llamadas): 16/18; fallaron los 2 duplicados porque la regla exacta no reconocía «Reponer guantes talla M en la sala 2» ni «Ordena la bodega de ropa limpia». Decisión de la persona dueña: regla por palabras, sin modelo. Una tarea abierta bloquea la propuesta si todas sus palabras de contenido (2 o más) aparecen en el título propuesto; se ignoran artículos y preposiciones, se quitan tildes y una raíz simple une «ordena» y «ordenar». Las letras sueltas cuentan como rótulos («pasillo A» ≠ «pasillo B»). Se agregó un conjunto de control aparte (NOTE_HOLDOUT, 4 casos: 3 duplicados parafraseados y «talla L» con «talla M» abierta, que sí debe proponerse); los 18 casos originales no cambian.
Archivos: server/task-duplicates.mjs (nuevo), ambient-engine.mjs, ENDPOINT.md, eval/note-corpus.mjs, eval/run-note-eval.mjs (--holdout), package.json, pruebas; eval/results/r5-note-DECISION-2026-11-12(-holdout).json.
VALIDATE: tester independiente: sin bloqueos; corregidos 2 hallazgos (letras sueltas tratadas como vacías; una tarea de una sola palabra ocultaba propuestas más largas). Colisiones de raíz conocidas y aceptadas (mes/mesa, paso/pasa): solo ocultan una propuesta; la persona puede crear la tarea a mano.
TEST: servidor 187 -> 202/202; evaluación sin conexión con control 22/22.
FIX: regla exacta -> regla por palabras; 2 correcciones del tester.
REPLAY: en vivo (DECISION, 18 + 4 de control, 32 llamadas: 20 Jev, 12 Haiku): 22/22; títulos útiles 7/7; 0 propuestas fuera del grupo tarea; 0 escrituras; 0 llamadas en casos obsoletos o no autorizados; p50 de extremo a extremo 2021 ms, p95 3046 ms. Comparación con el flujo manual: −42,9 % pasos y −63,2 % tiempo (meta 20 % cumplida).
LLM: 24 + 32 llamadas reales autorizadas. Costo Haiku estimado US$ 0,0023 + 0,0034 (Jev sin precio público); saldo 14,5018 -> 14,4930.
Riesgos/pendientes: muestra pequeña y sintética (22 casos); sin sinónimos («pedir» ≠ «solicitar»); la confianza de Jev no es probabilidad calibrada. Integrar a main sigue sujeto a la revisión legal y de privacidad y a la aprobación de la persona dueña. D3 y D4 siguen abiertas.
Veredicto: KEEP — GO a revisión.
Acción siguiente: decidir D3/D4 y si se abren R2/R3; R6 sigue DEFERRED.
```
