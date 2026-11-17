import { createAgentServer, positiveInteger } from './server.mjs';
import { redactSecrets } from '../scripts/check-secrets.mjs';

try {
  const server = createAgentServer({ log: record => console.log(JSON.stringify(record)) });
  const host = process.env.TURNO_AGENT_HOST || '127.0.0.1';
  const port = positiveInteger(process.env.TURNO_AGENT_PORT, 8787, 65535);
  server.on('error', () => {
    console.error(redactSecrets('endpoint_start_failed'));
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log('Turno agent listening'));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close();
      server.closeAllConnections();
    });
  }
} catch {
  console.error(redactSecrets('endpoint_start_failed'));
  process.exitCode = 1;
}
