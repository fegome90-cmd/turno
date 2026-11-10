# Turno — readiness para Sign in with ChatGPT / uso del plan personal
**Estado:** plan de cumplimiento y solicitud; NO integrado, NO autorizado, NO desplegado.
**Fecha de revisión:** 2026-11-10. **Alcance:** identidad y autorización OpenAI/ChatGPT de usuarios de Turno. Las evaluaciones de otros LLM las lleva otro agente.

## Objetivo del producto

Cada usuario de Turno puede organizar tareas sin IA y, si quiere, conectar **su propia** cuenta ChatGPT para recibir sugerencias ambientales mediante Strands Agents; su cuenta, consentimiento, límites y revocación son individuales. Nunca se utilizará la suscripción del propietario de Turno para atender a terceros. La IA propone; las escrituras en Turno siguen sujetas a revisión humana. El sistema no crea fichas clínicas paralelas ni toma decisiones asistenciales.

## Hallazgo normativo bloqueante

Los términos SIWC efectivos el **4 nov 2026** establecen que:
1. El uso del plan debe originarse en runtime local o remoto **controlado únicamente por ese usuario**.
2. Los tokens de autenticación persistentes deben almacenarse localmente bajo control del usuario, no en un entorno remoto/administrado.
3. El uso en segundo plano exige **consentimiento expreso** y no puede iniciarse por actividades de otros usuarios.
4. No se permite el pooling, transferencia, reventa o uso de una suscripción para solicitudes de otras personas.
5. La función de consumo del plan ChatGPT **no puede estar detrás de un pago o upgrade** exigido por Turno.

**Consecuencia:** un backend multiusuario compartido con refresh tokens de todos y jobs nocturnos no es una implementación permitida por defecto. Se necesita aprobación y definición contractual explícita de la arquitectura de hosting/custodia para el escenario web, o una variante de runtime exclusivamente controlado por el usuario. No se interpretará «socio seleccionado» como exención automática de estas cláusulas.

Referencias:
- https://openai.com/policies/sign-in-with-chatgpt-terms/
- https://developers.openai.com/siwc/website
- https://developers.openai.com/siwc/token-sharing-open-source

## Rutas consideradas

| Ruta | ¿Cumple objetivo de web compartida? | Decisión |
| --- | --- | --- |
| SIWC web alojada + uso de plan por usuario, con acceso de partner y arquitectura expresamente aprobada | Sí, sujeto a autorización | **Objetivo**. Solicitar acceso y aclaraciones antes de habilitar |
| Cliente/compañero local open source en runtime de cada usuario | Requiere instalación adicional, no satisface web pura | **Alternativa condicionada** si OpenAI no habilita la primera |
| Reutilizar tokens de Codex/Pi/OpenCode desde servidor compartido o recolectar cookies | No | **Prohibido**, no implementar |

La licencia del DevKit oficial `@siwc/local` es **Noncommercial License v1.0**. Excluye desarrollos usados por/para empleadores o empresas con finalidad operativa, incluso sin pago. Estudiar la documentación no autoriza copiar ese software a un producto para uso laboral. Requerir acuerdo escrito o implementación propia acorde con la documentación y términos aplicables.

Fuente: https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/LICENSE

## Plan en gates (sin trabajo de modelos ni cambios de runtime)

### G0 — Identidad, propósito y titularidad del producto (P0)
- [ ] Página pública propia de Turno con descripción, captura y repositorio.
- [ ] Identificar responsable de la solicitud, entidad/titularidad jurídica y contacto de soporte; no sugerir afiliación con hospitales/OpenAI sin autorización.
- [ ] Publicar política de privacidad y tratamiento de datos adecuada, y explicar que Turno es un organizador personal, no un EHR ni un dispositivo de decisión clínica.
- [ ] Documentar alcance inicial limitado a **datos sintéticos** en cualquier piloto de integración.

**Salida:** paquete de producto apto para solicitud, con responsables y URLs reales.

### G1 — Solicitud oficial y confirmación por escrito (P0)
Formulario: https://openai.com/form/sign-in-with-chatgpt-interest/

Campos verificados del formulario: work email, first name, last name, company name, website URL, job title (opcional), capacidades («Sign in and ChatGPT plan use for AI requests»), y descripción breve del producto.

Preguntas esenciales en seguimiento:
1. ¿Autorizarán SIWC para una web de Turno compartida entre usuarios independientes?
2. ¿Qué constituye un *remote runtime only that user controls* si la infraestructura es alojada? ¿Se requiere instancia aislada/usuario o custodia local?
3. ¿Dónde, cuánto tiempo y bajo qué contrato pueden residir access y refresh tokens? La regla pública prohíbe almacenamiento persistente en hosting compartido.
4. ¿Qué modalidad de registro y scopes habilitarían para identidad y *plan usage* en este caso concreto? ¿Existe client ID para desarrollo y URLs de callback registradas?
5. ¿Se permite la sugerencia ambiental activada por acciones del propio usuario y jobs explícitamente autorizados? ¿Qué prueba/registro de consentimiento exigen?
6. ¿Qué condiciones de uso, licencia, UX, privacidad y disponibilidad del plan aplican a un organizador personal pensado para profesionales de salud, sin información identificable de pacientes?
7. ¿Cómo preservar el acceso gratuito al uso del plan y los límites personales de cada cuenta?

**Gate:** NO construir el intercambio OAuth real ni almacenar tokens hasta recibir autorización e instrucciones compatibles con esta arquitectura. Si no hay autorización, seguir desarrollando Turno sin SIWC.

### G2 — Contratos internos sin OAuth real (P1, puede avanzarse)
Separar tres conceptos:
- `TurnoSession`: identidad/autorización de la app (independiente de ChatGPT).
- `OpenAIConnection`: identidad verificada, permisos y estado de conexión (NO incluir tokens en objetos UI).
- `InferenceCapability`: método que obtiene una propuesta de Strands bajo una conexión autorizada, sin exponer credenciales al agente ni permitir escrituras.

Estados de UI: `unavailable`, `disconnected`, `identity_only`, `consent_required`, `plan_active`, `limit_reached`, `reauthorization_required`. Mostrar «Conectar ChatGPT» **solo cuando** SIWC esté autorizado; antes, puede mostrarse un indicador neutro «Integración pendiente» en ajustes, sin botón falso.

Comportamiento: sin conexión, Turno debe seguir funcionando. No hacer cambios a PR de frontend o rama de modelos pertenecientes a otros agentes. El *feature flag* de SIWC debe permanecer apagado.

### G3 — Modelo de seguridad y privacidad (P0)
- Vinculación de cuentas por identificadores verificados `issuer + client_id + subject`, no por coincidencia de correo. Si corresponde, asociación al workspace autorizado.
- Al habilitar flujo web aprobado: OAuth Authorization Code + **PKCE S256**, `state`, `nonce`, callback exacta, transacción one-time y caducidad corta, validación de ID token (firma/JWKS, issuer, audience, exp, nonce), sesión propia de Turno en cookie Secure/HttpOnly/SameSite.
- Separar permiso de identidad (`openid profile email`) del permiso para consumir plan; no inferir permiso de plan a partir de un login correcto. Los scopes específicos para OSS (`offline_access resource.invoke chatgpt.tokens.use.direct`) deben confirmarse para el client registrado para web.
- Ningún token/cookie/código de autorización aparece en URL persistente, logs, frontend, repositorio o reporte de IA. Custodia y refresh según contrato aprobado, no usar mecanismos de Codex/Pi como atajo.
- Usuario A nunca usa credenciales, contexto ni límites del B; cerrar sesión de Turno no es lo mismo que desconectar/revocar ChatGPT.
- Política transparente de finalidad, retención/borrado, soporte, desconexión y manejo de incidentes.
- Fuera de alcance: datos clínicos identificables, pacientes reales, acciones terapéuticas y decisiones clínicas autónomas.

**Gate:** revisión de privacidad/seguridad antes de cualquier prueba real con usuarios o datos reales.

### G4 — Consentimiento explícito para agente ambiental (P0)
- Dos permisos distintos: **conectar cuenta** y **permitir que Turno haga análisis en background con mi plan**.
- Background **OFF por defecto**. Antes de activarlo, explicar qué eventos lo disparan (`note_saved`, `shift_close_attempt`, etc.), qué texto mínimo saldrá a OpenAI, frecuencia/límites y cómo pausar/revocar.
- Únicamente eventos iniciados por ese usuario o automatizaciones de su propiedad y autorizadas expresamente; jamás reacciones a actividad de otro usuario.
- Control visible: activar/desactivar, presupuesto de llamadas por sesión/turno, ver y gestionar uso, desconectar. Al perder consent o credencial válida, **0 solicitudes adicionales**.
- Sin chatbot y sin herramientas de escritura: la salida de Strands es una propuesta revisable en tarjeta o toast; no tarea guardada.
- No suponer facturación propia ni compensar límites con la cuenta del dueño de Turno.

**Gate:** pruebas de revocación durante tarea, switch de usuarios, flujo de consentimiento rechazado y jobs previamente programados.

### G5 — Compatibilidad Strands + Responses API (después de G1)
- Mantener Strands como agente; usar un adaptador OAuth acotado por usuario para el proveedor OpenAI.
- La ruta SIWC OSS documenta `POST https://api.openai.com/v1/responses`, `store:false`, `stream:true`, `input` como arreglo, y espera `response.completed`.
- El perfil de uso de plan **no acepta** ciertos campos comunes: entre ellos `max_output_tokens`, `temperature`, `background`, `conversation`, `metadata`, `previous_response_id` y otros listados en preview limitations.
- El `OpenAIModel` de Strands puede enviar parámetros incompatibles si se configura con límites por petición. Validar cuerpo real de salida del adaptador antes de habilitar inferencia; usar budgets fuera del payload cuando sea necesario.
- No asumir que todos los usuarios tienen los mismos modelos: descubrir catálogo/entitlement con su token y detener inferencia ante scopes insuficientes, revocación o límite de uso.
- Errores recuperables: acceso denegado, consentimiento no concedido, 401, 403, límites de uso, refresh revocado y cortes de stream. **No fallback automático a una cuenta ajena**.

Fuentes:
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery
- https://strandsagents.com/docs/user-guide/sdk/model-providers/openai-responses/

### G6 — Evidencia y prueba de aceptación (después de G1-G5)
**Pruebas sintéticas**: dos cuentas A/B, cambio de sesión en misma máquina, revocación tras conexión, consentimiento de background ausente/rechazado/retirado, token expirado, límite de uso, callback repetido o manipulado, respuesta incompleta, ausencia de permiso de plan, app sin ChatGPT.

Criterios bloqueantes:
1. A/B sin filtración de tokens, memoria, tareas, identidad ni gasto.
2. Sin consentimiento expreso de background, **cero invocaciones** disparadas automáticamente.
3. Logout y revocación funcionan según contrato. A falta de conexión, tareas siguen disponibles.
4. No hay almacenamiento remoto persistente de credenciales sin permiso escrito explícito.
5. La función SIWC está disponible sin pagar/upgrade de Turno.
6. Solo se presentan propuestas; persistencia exige aprobación humana.
7. `store:false` y `stream:true` confirmados en solicitudes de plan SIWC, sin campos incompatibles.
8. Auditoría de privacidad, licencia, seguridad y uso realizada antes de prueba con usuarios reales.

**No hay aprobación ni pruebas reales SIWC al 10-11-2026.**

## Solicitud inicial: texto propuesto en inglés

**Capability:** Sign in and ChatGPT plan use for AI requests.

**Product description:**

Turno is an independent task and shift organization application designed for individual professionals. It manages personal tasks, schedules, and notes. We are developing an optional, non-conversational Strands Agents feature that produces contextual suggestions for human review; it does not make clinical decisions or write changes automatically. We would like each eligible user to connect their own ChatGPT account and authorize usage under their own plan and limits, never sharing subscription usage across people. Background analysis would be disabled by default and require explicit user consent. Our early integration tests use synthetic data only. We seek guidance and partner eligibility for a remotely hosted, multiuser web application, particularly the permitted user-controlled runtime and credential storage architecture, OAuth client registration, and plan-usage scope. Use of the ChatGPT plan through this integration would not require users to pay us or upgrade their Turno plan.

**Antes de enviar:** completar nombre/titularidad del producto, URL real de demo/landing page, contacto de trabajo y revisión de la descripción con el alcance real. No afirmar certificaciones, despliegue comercial o contrato con OpenAI inexistentes.

## Delimitación de trabajo

- Este documento es una **propuesta y checklist de cumplimiento**, no aprobación legal ni técnica de OpenAI.
- El otro agente conserva exclusivamente la evaluación e integración de otros LLM; este documento no modifica su rama ni test.
- Cambios de producto y autenticación quedan en HOLD hasta gates correspondientes.
