#!/usr/bin/env node
/**
 * One-command relay setup (pull published image).
 * Usage: npm run install-relay
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const installDir = join(root, 'tesla-desktop-relay');
const relayEnv = join(installDir, '.env');
const relayEnvExample = join(root, 'relay', '.env.example');
const composeSrc = join(root, 'compose', 'relay.yml');
const composeDest = join(installDir, 'compose.yml');

mkdirSync(installDir, { recursive: true });
copyFileSync(composeSrc, composeDest);

if (!existsSync(relayEnv)) {
  copyFileSync(relayEnvExample, relayEnv);
  console.log('Created tesla-desktop-relay/.env — edit before going live.');
}

for (const args of [
  ['compose', '-f', composeDest, 'pull'],
  ['compose', '-f', composeDest, 'up', '-d'],
]) {
  console.log(`Running: docker ${args.join(' ')}`);
  const result = spawnSync('docker', args, { stdio: 'inherit', cwd: installDir });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('');
console.log('Relay: http://localhost:8443/health');
console.log('Edit tesla-desktop-relay/.env then: docker compose -f tesla-desktop-relay/compose.yml up -d --force-recreate');
