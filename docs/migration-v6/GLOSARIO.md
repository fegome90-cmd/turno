# Glosario de Turno

Vocabulario congelado de la v5 para la migración (decisión del dueño, 08/11/2026). **No validado por una persona del dominio**; queda anotado como pendiente.

Turno es un gestor de tareas general para trabajos por turnos o jornadas ([propósito](../../prototypes/frontend-v5/README.md#propósito-del-producto)). Los términos deben servir para cualquier trabajo por turnos; los ejemplos de enfermería son un caso de uso.

| Término en v5 | Término en v6 | Significado |
|---|---|---|
| Turno | Turno | Jornada de trabajo con inicio y cierre. Al cerrarlo se archiva con sus pendientes. |
| Cama («Camas», «Cama 1», «Agregar cama») | **Lista** («Listas», «Lista 1», «Agregar lista») | Grupo de tareas dentro de un turno. El nombre lo pone quien la usa; en enfermería puede llamarse «Cama 3». |
| Tarea | Tarea | Algo por hacer, con título, motivo, prioridad, fecha, hora, estimación y registro de realización. |
| Motivo | Motivo | Por qué existe la tarea (por ejemplo «Exámenes»). |
| Prioridad (Normal, Alta, Baja) | igual | Solo «Alta» se muestra en la lista y en la Agenda. |
| Notas rápidas | Notas rápidas | Notas independientes de los turnos y las listas. |
| Tiempo | Tiempo | Panel con fechas y horas de la tarea y la Agenda. |
| Agenda | Agenda | Tareas del turno ordenadas por fecha y hora, incluidas las sin fecha. |
| Turnos anteriores / Archivo | igual | Turnos cerrados, de solo lectura. |
| Inicio | Inicio | Saludo, frase y resumen del turno abierto. |

El cambio de «Cama» a «Lista» es la única excepción de texto a la paridad con v5. Afecta a interfaz y pruebas de la v6; la v5 no se modifica.
