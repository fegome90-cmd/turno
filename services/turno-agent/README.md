# Turno · Strands ambiental (experimento aislado)

**No está conectado a Turno v6, ni desplegado, ni habilitado para pacientes reales.** La demo v6 sigue siendo estática, sin autenticación ni backend. Este paquete prepara el motor de interpretación y sugerencias en servidor.

## Componentes

- `src/gateway-agent.mjs`: **Strands Agents** con el adaptador oficial `VercelModel` y proveedor Vercel AI Gateway. Solo inferencia remota.
- `src/decisions-api.mjs`: `experimental_decide` con `gateway.decisionModel`; clasificación cerrada por API, no reemplaza al motor Strands.
- `src/semantic-decision.mjs`: modos `GATEWAY`, `DUAL` (Strands activo, Decision API en sombra) y `DECISIONS`.
- `src/ambient-policy.mjs`: reglas deterministas para coincidencia de tareas, cama desconocida, fecha faltante y pendiente antes del cierre.
- `src/suggestion-gate.mjs`: deduplicación y enfriamiento de notificaciones. No escribe datos.

## Secretos

Preferir OIDC cuando se despliegue en Vercel. En otro backend, configurar `AI_GATEWAY_API_KEY` como secreto de runtime. Nunca poner API keys en el navegador, `VITE_`, `NEXT_PUBLIC_`, la consola, las respuestas ni en GitHub. Para desarrollo privado copiar `.env.example` a `.env`; ese archivo queda ignorado por Git. `readGatewayConfig` nunca devuelve los secretos.

**No existe endpoint público ni permiso para usar datos reales**. Por diseño, la prueba rechaza cualquier entrada que no sea `source: 'synthetic'`. Esa bandera no garantiza anonimización; son datos de laboratorio.

## Verificación offline

```sh
cd services/turno-agent
node --test tests/*.test.mjs
node src/demo.mjs
npm run check:syntax
```

Los tests usan adaptadores simulados y no requieren API keys. No prueban una conexión real. El servicio declara Node 24+ porque así lo requiere la integración con React v6. Este entorno de edición tenía Node 22.16, por lo que las pruebas ejecutadas solo verifican la lógica compatible con ese runtime.

## Instalar para una prueba remota posterior

```sh
npm install
```

Este entorno no tenía acceso al registry, así que **no se ha generado lockfile ni probado una inferencia real**. Antes de promover, generar y versionar `package-lock.json`, comprobar el SDK instalado, ejecutar `npm ci` y probar credenciales y permisos en el destino.

## Contrato UI posterior

Solo tras contar con API autenticada: un evento de Turno genera una propuesta de solo lectura, se valida y filtra, se muestra en un toast discreto y un botón abre revisión. Guardar una tarea requiere confirmación explícita y la validación del backend original de Turno.

- [Spec](../../docs/superpowers/specs/2026-11-10-ambient-strands-gateway-design.md)
- [Plan](../../docs/superpowers/plans/2026-11-10-ambient-strands-gateway.md)
