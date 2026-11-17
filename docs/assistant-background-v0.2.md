# Turno — Agente ambiental con inferencia remota (v0.2)

**Estado:** piloto de backend sin despliegue ni integración en Turno; **solo sintéticos**. Sustituye la propuesta v0.1 basada en OpenCode y Strands Decider local.

## Decisión

Strands Agents es la base del análisis semántico. Se utiliza exclusivamente inferencia mediante APIs, con **Vercel AI Gateway** y autenticación OIDC del proyecto o `AI_GATEWAY_API_KEY` guardada como secreto en backend. Ninguna credencial pasa por la interfaz. **No hay chatbot**. El agente nunca escribe: propone tarjetas `review/dismiss` que la aplicación puede presentar como sugerencias.

## AWS → Turno

Amazon sustituyó una **clasificación concreta** por Strands Decider con un switch `BEDROCK/DUAL/DECIDER`. Turno adapta el patrón, **no sus servidores ni la promesa del 98% de ahorro**:

| Turno | Motor activo | Motor sombra |
| --- | --- | --- |
| `GATEWAY` | Strands + modelo remoto de Gateway | ninguno |
| `DUAL` | Strands + modelo remoto de Gateway | Decision API remota (Microsoft Decision-1) |
| `DECISION` | Decision API remota y abstención | ninguno |

El modelo de decisión es **otro producto** de inferencia remota, no Strands Decider. Su uso en Turno no prueba equivalencia ni calidad con el E4B que evaluó Amazon.

## Contrato de seguridad

El backend autentica y autoriza antes de entregar un snapshot del turno al analizador. El piloto impide procesamiento de contenido real: `TURNO_SYNTHETIC_ONLY=1`, evento `synthetic=true` obligatorio, y feature flag `TURNO_AI_ENABLED=0` por defecto. Ante un fallo o salida no válida, el modelo se abstiene. Sin herramientas de escritura ni endpoints públicos. Cualquier uso de datos clínicos requiere análisis institucional de privacidad, contrato y gobernanza independiente.

## Flujo sin chat

Evento del editor → verificación backend → reglas de dominio y/o Strands → propuesta tipada → política de interrupciones → bandeja/ toast eventual → usuario revisa → backend hace el único guardado.

En el ejemplo de tres tareas sintéticas, el código detecta cama 4 no vinculada, ausencia de fecha confirmada en 15:00 y dos tareas que comparten horario, pero **no deduce que sean duplicadas**. Al cierre puede sugerir revisar el informe pendiente, sin asignar un horario arbitrario. Estos cuatro hallazgos deben ser deterministas y gratuitos.

El modelo semántico se reserva para notas libres que expresen tareas o avisos, con catálogo `NO_ACTION`, `PROPOSE_TASK`, `PROPOSE_REMINDER`, `NEEDS_REVIEW`. No se debe usar para prioridad clínica, alertas terapéuticas o conclusiones sanitarias.

## Evaluación

Comparar clasificadores en `DUAL` sobre dataset sintético etiquetado manualmente y guardar métricas sin texto sensible: acuerdo, errores, abstenciones, costo y latencia. El umbral experimental inicial (0.90) **no equivale a calibración validada**. Habilitar `DECISION` solo después de analizar desacuerdos. En todos los modos se requiere consentimiento para guardar.

## Límites del entregable

El worker aún no está conectado al backend autenticado ni a la UI; no se guarda ni ejecuta ninguna tarea. El primer módulo ejecutable se encuentra en `server/`, con pruebas y demo sintética. No hay keys configuradas ni pruebas con servicios reales.

Documentación técnica: [server/README.md](../server/README.md).
