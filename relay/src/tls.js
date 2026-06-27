import { existsSync, readFileSync } from 'node:fs';

export function loadTlsCredentials(keyPath, certPath) {
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    throw new Error(
      `TLS certificate not found (${keyPath}, ${certPath}). Restart the container to generate one.`,
    );
  }
  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}
