# Turno — agente ambiental con Strands y Decider (v0.1)

**Estado:** arquitectura candidata. No hay agente ni servidor Decider conectados, despliegue, API pública ni tratamiento de datos clínicos. Usar solo fixtures sintéticas.

## Decisión de producto

Turno no tendrá chatbot. Strands Agents SDK para TypeScript será el **orquestador del agente**, ejecutado por eventos autorizados y con herramientas de **solo lectura**. OpenCode (Zen/Go) se utilizará a través del adaptador de Strands [@guru.prasath/model-opencode](https://github.com/aprasadh/model-opencode) para extraer e interpretar lenguaje natural. Strands Decider es un **modelo independiente de decisiones cerradas**; no genera texto y no reemplaza a Strands Agents ni a OpenCode para captura libre.

El agente no recibe permisos para crear, completar, borrar tareas, programar avisos, modificar prioridades ni cerrar el turno. Todas las escrituras atraviesan el backend de Turno y requieren aprobación humana.

## Patrón copiado del caso de Amazon (9 noviembre 2026)

Referencia primaria: https://strandsagents.com/blog/amazon-saves-millions-replacing-sonnet-with-strands-decider/

Amazon sustituyó **una tarea de etiquetado de tickets**, no todo el agente. Usó un catálogo cerrado de 20 etiquetas, Strands Decider E4B (Gemma 4) con selección probabilística, umbrales calibrados y un switch de tres estados:

| AWS | Turno | Comportamiento |
| --- | --- | --- |
| BEDROCK | `OPENCODE` | Strands + OpenCode clasifican una señal; resultado es **candidato para revisión humana** |
| DUAL | `DUAL` | OpenCode determina el candidato, Decider clasifica **en paralelo y en sombra**; divergencias se guardan en una traza mínima sin contenido clínico |
| DECIDER | `DECIDER` | Decider decide **solo el tipo de señal semántica cerrada**, nunca inventa títulos, fechas o textos; ante baja confianza o fallo se abstiene |

El modo se selecciona con `TURNO_DECISION_MODE` en el **backend**. Un estado `OFF` o un kill-switch de despliegue podrá inhibir todo el análisis automático; no debe bloquear el gestor de tareas. Ningún modo habilita escrituras autónomas.

**Límites de la analogía:** la reducción de costos del 98% reportada por Amazon es específica de clasificación masiva. No usarla como predicción económica para Turno, cuyos volúmenes y decisiones son diferentes. Tampoco copiar SageMaker, SQS, Lambda, CDK ni AppConfig si un proceso sencillo con una cola local controlada satisface el piloto.

## Recorridos principales

1. **Captura:** en el editor normal se dicta o escribe texto libre. Strands invoca OpenCode y devuelve borradores JSON. Las tarjetas de revisión permiten editar, resolver cama/fecha y aceptar individualmente. Sin aprobación: **0 escrituras**.
2. **Observación:** eventos `note_saved`, `task_saved` y `shift_close_attempt` despiertan el analizador en background. Se inspecciona un snapshot permitido (IDs, estado, fecha/hora, texto sintético mínimo). Primero pasan **reglas deterministas** para datos evidentes. Solo la ambigüedad semántica pasa a Strands+OpenCode o Decider.
3. **Presentación:** bandeja de sugerencias por defecto; toast no intrusivo como excepción con deduplicación, enfriamiento y expiración. Un clic abre revisión; jamás un chat.
4. **Acción:** la API de Turno revalida autenticación, versión, contexto, pertenencia de cama y datos. El agente no tiene ninguna herramienta de escritura.

## Taxonomía inicial para clasificación semántica

Catálogo congelado para evaluación; labels en inglés son claves estables, no textos de UI:

- `NO_ACTION`: comentario contextual sin tarea/recordatorio derivable.
- `PROPOSE_TASK`: expresión explícita o implícita de un trabajo personal pendiente.
- `PROPOSE_REMINDER`: solicitud de ser avisado en otro momento, cuya fecha/hora podría requerir aclaración.
- `NEEDS_REVIEW`: ambigüedad suficiente para no clasificarla automáticamente.

Una respuesta de Decider trae etiqueta y confianza, no un toast completo. Un resultado de OpenCode puede traer una clase y, en otro recorrido, contenido propuesto para captura. Los resultados se validan por esquema; un error o clase desconocida produce `NO_ACTION`/abstención, nunca una acción arbitraria.

El `DECIDER` no decide la prioridad clínica ni diagnostica, no asigna camas faltantes y no crea horas. No existe una etiqueta `PRIORITY_HIGH` basada en predicción.

## Tres tareas sintéticas de aceptación

- Revisar tarea pendiente A (15:00, cama 4).
- Revisar tarea pendiente B (15:00, cama 4).
- Completar informe (antes del cierre).

**Reglas, no modelos:** dos tareas comparten 15:00 y cama 4; el sistema puede advertir coincidencia, pero no deduce duplicidad. Las 15:00 sin fecha requieren confirmar la fecha del turno activo. La cama 4 debe vincularse a un bedId existente o crearse explícitamente porque el prototipo v5 incluye cama 1 y 2. «Antes del cierre» se conserva como instrucción y no se convierte en una hora ficticia. El cierre pendiente se evalúa por el estado real del sistema.

**Caso que sí justifica Decider:** una nota libre como «acuérdate de revisar el informe antes de cerrar» se clasifica entre `PROPOSE_REMINDER`, `PROPOSE_TASK`, `NO_ACTION`, `NEEDS_REVIEW`. Se evalúa con ejemplos de variaciones chilenas, negaciones, ironía, texto clínico excluido y ambigüedad; el resultado solo propone revisión.

## Evaluación inspirada en Amazon

Primero crear dataset sintético etiquetado manualmente. Comparar `OPENCODE` vs `DECIDER` sin aplicar consecuencias. El primer despliegue del piloto usa `OPENCODE`, luego `DUAL` en sombra; habilitar `DECIDER` solo para tipos cerrados que alcancen criterios de precisión y abstención acordados. Evaluar todos los desacuerdos y estimar tasas de falso positivo, omisiones, costo por evento, latencia, tokens y carga de interrupciones. El umbral de confianza se fija según estos datos: **0.90 es solo un valor técnico inicial de laboratorio**, no una calibración clínica.

En el artículo, Amazon encontró una variación de hasta 0.19 en probabilidades al cambiar el orden de claves JSON: los objetos enviados al clasificador deben serializarse con orden de claves **estable**; también conservar versión de modelo, política y catálogo de etiquetas para reproducibilidad. Los modelos pueden truncar contexto, por lo que hay que medir y rechazar casos fuera de ventana cuando afecte a la decisión.

## Separación de despliegue

```text
Interfaz Turno
  ├── editor de tareas → revisión humana → API de Turno (único writer)
  └── eventos autorizados
         ↓
  worker de Turno / Strands Agents SDK
         ├── validaciones/reglas locales
         ├── OpenCode Zen/Go [inferencia generativa mediante proveedor Strands]
         └── Strands Decider [servicio HTTP separado, clasificador]
                 ↓
       propuesta estructurada + filtro de políticas
                 ↓
        bandeja / toast contextual (sin escritura)
```

El endpoint de referencia de Strands Decider es `POST /v1/systemone`, enlazado por defecto a `127.0.0.1`, **sin autenticación**. No exponerlo a Internet ni al navegador. Es una opción de laboratorio local, no un despliegue productivo validado.

Para Mac Apple Silicon, el repositorio de Decider documenta un motor MLX para Qwen3.5 2B; la disponibilidad y rendimiento de MLX para el E4B Gemma 4 específico de Amazon se deben comprobar por separado. El proveedor OpenCode no sirve el modelo Decider: ambos son rutas distintas del orquestador.

## Seguridad

`OPENCODE_API_KEY` se mantiene como secreto de servidor (ver `server/.env.example`), nunca en una pantalla de Turno, en el repositorio, en logs ni en el JavaScript del navegador. OpenCode Go necesita `sessionId` separado por usuario/contexto y generado/controlado por el backend. Todas las pruebas iniciales contienen solo datos sintéticos; los datos reales identificables requieren un análisis institucional propio previo.

## Referencias

- Caso AWS: https://strandsagents.com/blog/amazon-saves-millions-replacing-sonnet-with-strands-decider/
- Modelo y documentación de inferencia: https://github.com/strands-labs/strands-decider
- Servidor Decider: https://github.com/strands-labs/strands-decider/blob/main/docs/inference.md
- Adaptador comunitario OpenCode para Strands: https://github.com/aprasadh/model-opencode
