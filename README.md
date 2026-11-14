# Turno

Turno es un gestor de tareas, notas y jornadas de trabajo de propósito general, con asistencia discreta y control de la persona sobre las acciones. Está pensado para personas de cualquier profesión; trabajar por turnos es un contexto posible, no un requisito de acceso.

Su uso en salud por parte de una persona no lo convierte en una aplicación clínica, una ficha de pacientes ni un sistema de decisiones asistenciales. Los ejemplos de oficina, logística, taller o salud no definen el dominio del producto.

El [alcance vigente y las puertas de integración/activación](docs/agente-roadmap.md#alcance-vigente-y-puertas-del-pr-4-14-11-2026) separan el merge del código, la activación de IA y el uso con datos reales. Los datos sintéticos son una restricción del entorno de pruebas actual, no del público objetivo de Turno.

Los prototipos de interfaz se mantienen separados del backend. Su presencia no implica una release, integración ni despliegue.

## Documentación del frontend

- [Migración propuesta a React y Base UI: plan auditado, matriz de paridad, preparación y bloqueos](docs/migration-v6/README.md).
- [Preparación histórica de fase 0 y contrato](docs/migration-v6/FASE_0.md); aprobación registrada en [G0-RECORD](docs/migration-v6/phase-0/G0-RECORD.md).
- [Investigación React al 08/11/2026 y decisiones condicionadas de versiones, seguridad y portabilidad](docs/migration-v6/REACT_RESEARCH.md).
- [Estado actual de 4A/4B y próximos gates](docs/migration-v6/STATUS-4B.md): candidato de código `ed374be`, regresión Chromium Mac 226/226 y dos auditorías BLOCKED; G4A/G4B siguen STOP. El [estado 2B](docs/migration-v6/STATUS-2B.md) se conserva como registro histórico.
- V5 se conserva como referencia. [Frontend v6](prototypes/frontend-v6/README.md) integra editores, notas, Tiempo/Agenda, guardas, historial y ciclo de turno con datos demo de sesión. Sin backend, autenticación, persistencia ni colaboración.
