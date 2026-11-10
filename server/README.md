# Turno / OpenCode: configuración privada

Esta carpeta **prepara**, pero todavía no implementa ni despliega, la integración de Turno con Strands Agents y el proveedor comunitario [model-opencode](https://github.com/aprasadh/model-opencode). No existe aquí un endpoint HTTP público, persistencia ni conexión con datos clínicos. Ninguna API key está incluida en GitHub.

## Configuración local (Mac)

Desde la raíz del repositorio:

```sh
cp server/.env.example server/.env
chmod 600 server/.env
```

Edita **solo en tu computador** el archivo `server/.env` y pega la clave en `OPENCODE_API_KEY=`. No la envíes por chat ni la incluyas en commits, capturas o logs. El archivo `.env` y sus variantes están excluidos por `.gitignore` en todas las carpetas.

```sh
cd server
node --env-file=.env check-config.mjs
npm test
```

El chequeo **no hace peticiones a OpenCode ni muestra la clave**. También puedes verificar desde la raíz con `git check-ignore server/.env`: debe responder `server/.env`.

## Proveedor y modelo

El archivo `opencode-provider.mjs` expone `createOpenCodeModel({ sessionId? })`, un constructor exclusivo del servidor que importa `@guru.prasath/model-opencode`. Para usarlo en una integración posterior hay que instalar las dependencias, revisar el paquete y verificar compatibilidad con el endpoint y modelo elegidos. No se instaló ni ejecutó una llamada de inferencia con credenciales reales.

- `OPENCODE_MODE=zen`: usa OpenCode Zen.
- `OPENCODE_MODE=go`: usa OpenCode Go, exige `sessionId` proporcionado por el backend, estable dentro de un contexto y distinto entre turnos/usuarios.
- `OPENCODE_MODEL_ID`: modelo elegido (el ejemplo es ilustrativo; debe verificarse disponibilidad).

No pongas una sesión global compartida en `.env`. No aceptes sin validar un `sessionId` arbitrario del navegador. El servicio backend tendrá que generar y asociar el identificador al contexto autorizado de Turno.

El paquete de terceros `@guru.prasath/model-opencode` está fijado en versión `0.1.0` y **no es un componente oficial de Turno ni de OpenCode**. Sus versiones y endpoints se deben revisar antes de habilitarlo, en particular las URL de OpenCode Console actuales frente a las URL Zen codificadas por el adaptador.

## Despliegue futuro

Configura `OPENCODE_API_KEY` como **secreto del servicio backend** o de su gestor de secretos. No uses prefijos públicos como `VITE_` ni `NEXT_PUBLIC_`, no incrustes credenciales en JavaScript descargable por el navegador y no transmitas la clave desde el frontend. GitHub Actions Secrets solo sirven para un workflow que realmente los necesite, no sustituyen los secretos del runtime.

La captura inteligente seguirá el contrato: entrada -> propuesta -> revisión humana -> validación/guardado por Turno. Este módulo no escribe tareas. El asistente ambiental propuesto está documentado en `../docs/assistant-background-v0.1.md`.
