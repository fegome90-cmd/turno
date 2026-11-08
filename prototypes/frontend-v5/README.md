# Turno: prototipo de frontend · diseño v7

Demostración aislada de la interfaz de Turno. No es una release ni el plugin oficial; no está conectada al backend y no se ha desplegado.

## Alcance

- Inicio, turnos, grupos de tareas editables, notas, Agenda y archivo.
- Datos sintéticos en memoria. Todo se reinicia al recargar.
- Sin autenticación, API, persistencia, recordatorios ni datos reales de pacientes.
- El perfil de ejemplo usa el nombre genérico **Demo**.
- No introducir información real ni datos que necesites conservar.

El código se mantiene dentro de `prototypes/frontend-v5/` para no imponer estructura ni contratos al backend que se desarrolla por separado.

## Ajustes de diseño (v7 completado)

Navegación compacta con Demo y el aviso dentro de Más opciones, cierre de turno en la barra superior, controles táctiles, prioridad visible, filtros y edición reconocible. Incluye tema claro, oscuro o del sistema, seis roles tipográficos en rem y ancho de editor compartido. Se conserva el saludo por nombre de perfil, sus cuatro frases y el movimiento v6. La copia pública usa Demo; el generador admite --preferred-name para un preview local personalizado no versionado.

[Correspondencia con la auditoría, decisiones y límites de verificación](docs/DESIGN_V7.md).

## Ajuste de pantalla completa y resize

El editor conserva su límite legible de 76ch y se centra en el espacio disponible. La cuadrícula ocupa el ancho del contenedor. Al volver a escritorio, los paneles abiertos en drawer regresan a sus columnas sin reconstruir el editor. Se conservan borrador, errores, pestaña, filtros, tema y scroll. Inicio y un inspector ocultado explícitamente conservan Tiempo como overlay.

[Diagnóstico y pruebas de viewport](docs/VIEWPORT.md).

## Avisos expandidos (v6)

La nueva pila conserva cada aviso hasta cerrarlo, agrupa repetidos, permite cierres individuales y mantiene los errores disponibles. Alt+T lleva a los avisos; Escape cierra el aviso enfocado. Se inspira en el modo expandido de Sonner, con implementación propia para la demo vanilla y sin instalar React.

Entrada/salida de avisos a 300 ms para puntero, instantánea para teclado o movimiento reducido. Desde la integración del PR #1, las pantallas usan 150 ms (solo opacidad), los diálogos 240 ms y el drawer 260 ms; con movimiento reducido queda un fundido de opacidad de hasta 150 ms. No se afirma fluidez sin QA visual.

[Decisiones, skills consultadas, licencias y límites](docs/MOTION_V6.md).

## Ejecutar localmente

Desde este directorio, con Node.js 20.19 o superior y Python 3:

```sh
npm ci --ignore-scripts
npm test
python scripts/build_preview.py
node scripts/check_portable.mjs
npm run preview
```

Abrir `http://127.0.0.1:4175/`. También se genera `preview.html`, un HTML autónomo con los assets incluidos. Ese archivo generado y `node_modules/` no se versionan.

## Comprobaciones y límites

La suite automatizada comprueba lógica, contratos de estilos y DOM simulado mediante LinkeDOM. No reemplaza pruebas visuales ni demuestra foco nativo, accesibilidad, rendimiento o compatibilidad móvil real. El backend y la integración con ChatGPT no se prueban aquí.

Antes de integrar, hacen falta QA en navegadores y dispositivos reales, revisión de accesibilidad y un contrato acordado con el backend.

## Procedencia

Base: candidato v5 de Turno. Esta copia para GitHub incluye código, tests, assets y licencias. Se sustituyó el nombre personalizado por **Demo** en los datos de ejemplo y sus aserciones, y se omitieron informes históricos y archivos generados. Los assets usados conservan sus bytes originales. Se retiran dos fuentes no referenciadas, conservando sus licencias.

Fuentes Source Sans 3 y Source Serif Pro bajo SIL Open Font License; iconos Lucide bajo ISC. Las atribuciones aplicables están en `licenses/`. La marca Turno se incluye como asset del proyecto; no se concede una licencia general sobre ella ni sobre el código del proyecto.
