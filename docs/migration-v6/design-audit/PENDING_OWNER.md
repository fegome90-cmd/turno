# Pendiente del dueño (segunda ronda)

Las cuatro decisiones de la primera ronda ya están resueltas y registradas (producto, vocabulario, movimiento del plan, inventario). Quedan dos puntos nuevos. Ninguno se aprobó por delegación.

## 1. Solo se evaluó un componente de los doce que traerá la migración (Necesidad de componentes y Origen de recursos)

**Qué encontré.** El router exige una sesión por cada requisito de componente, con su candidato, fuente y versión. En esta pasada abrí una sola, "Más opciones" como Popover no modal (D2), con Base UI 1.9.0 y, aparte, con el recurso actual de v5. Quedan sin sesión: diálogos y confirmaciones, drawer, pestañas con indicador, desplegable de Tiempo, casillas, campos de formulario y número (D3), avisos con Sonner 2.0.8 (D4), estado con zustand 5.1.0, clases con clsx 2.1.1 e iconos con lucide-react 1.70.0. Para Base UI en "Más opciones", cinco de los seis ejes quedaron sin verificar (compatibilidad de la exportación Popover, licencia, seguridad, accesibilidad real y coste), porque dependen de código v6 que aún no existe. Ninguna de las licencias de las dependencias nuevas está registrada en los documentos.

**Por qué importa.** El plan deja esta evaluación para la fase 1B, pero sin ella el router no da por cerrada la adopción de ninguna librería. Sonner (D4) y NumberField (D3) son los de más riesgo, porque el plan dice que una brecha sin resolver detiene la fase.

**Opciones.**
- A. Abrir una sesión por componente al empezar la fase 1B, con pruebas reales en Chromium, y registrar licencias al crear el lock en 1A.
- B. Abrir ahora solo las de más riesgo (Sonner, NumberField, Dialog sobre Drawer) y dejar el resto para después.

**Recomendación.** A, con B como orden de arranque.

## 2. La hoja de "Contexto incompleto" no se pudo aprobar en el registro (C03)

**Qué encontré.** Tu decisión sobre el vocabulario quedó registrada en la pregunta de Contexto, pero el router marca su hoja final como ruta bloqueada a propósito y no permite ni proponerla ni confirmarla. No hay nada que hacer por tu parte salvo saber que aparece como bloqueada mientras la validación de una persona del dominio siga pendiente. Si más adelante alguien la valida, hay que reabrir ese nodo.

**Recomendación.** Dejarla así y revisarla cuando haya validación de dominio.
