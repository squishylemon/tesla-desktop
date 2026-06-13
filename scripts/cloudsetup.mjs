#!/usr/bin/env node
/**
 * One-command cloud relay setup for domain operators.
 * Usage: npm run cloudsetup
 *    or: docker compose --profile cloudsetup up --build -d
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const relayEnv = join(root, 'relay', '.env');
const relayEnvExample = join(root, 'relay', '.env.example');

if (!existsSync(relayEnv)) {
  copyFileSync(relayEnvExample, relayEnv);
  console.log('Created relay/.env from relay/.env.example');
  console.log('');
  console.log('Edit relay/.env before going live:');
  console.log('  - ALLOWED_IPS        (* or your home IP to restrict who can register)');
  console.log('  - RELAY_BASE_DOMAIN  (your domain)');
  console.log('  - RELAY_OAUTH_HOST   (auth.yourdomain.com — point DNS at this server)');
  console.log('  - TESLA_CLIENT_ID / TESLA_CLIENT_SECRET');
  console.log('  - CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID / RELAY_DNS_TARGET');
  console.log('  - RELAY_INACTIVITY_DAYS / RELAY_CLEANUP_INTERVAL_HOURS');
  console.log('');
} else {
  console.log('Using existing relay/.env');
}

const composeFile = join(root, 'docker-compose.yml');
const args = [
  'compose',
  '-f',
  composeFile,
  '--profile',
  'cloudsetup',
  'up',
  '--build',
  '-d',
];

console.log(`Running: docker ${args.join(' ')}`);
const result = spawnSync('docker', args, { stdio: 'inherit', cwd: root });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('');
console.log('Relay is starting. Check logs:  docker compose --profile cloudsetup logs -f relay');
console.log('Health check:                   curl http://localhost:8443/health');
console.log('');
console.log('Tesla developer portal (once):');
console.log('  Allowed Origin:  https://auth.yourdomain.com');
console.log('  Redirect URL:    https://auth.yourdomain.com/auth/callback');
console.log('');
console.log('Home installs set:  RELAY_API_URL=https://auth.yourdomain.com');
