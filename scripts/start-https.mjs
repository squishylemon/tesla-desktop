import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';

const keyPath = process.env.APP_TLS_KEY ?? '/data/app-tls-key.pem';
const certPath = process.env.APP_TLS_CERT ?? '/data/app-tls-cert.pem';
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4321);

const { handler } = await import('../dist/server/entry.mjs');

const server = createHttpsServer(
  {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  },
  handler,
);

server.listen(port, host, () => {
  console.log(`Tesla Desktop listening on https://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
