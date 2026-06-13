import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAllowedIps } from './allowed-ips.js';

function required(name, value) {
  if (!value?.trim()) throw new Error(`Missing required env: ${name}`);
  return value.trim();
}

export function getConfig() {
  const dataDir = process.env.DATA_DIR ?? './data';
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const baseDomain = required('RELAY_BASE_DOMAIN', process.env.RELAY_BASE_DOMAIN);
  const oauthHost = required('RELAY_OAUTH_HOST', process.env.RELAY_OAUTH_HOST);

  return {
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 8443),
    dataDir,
    storePath: join(dataDir, 'relay-instances.json'),
    baseDomain,
    oauthHost,
    oauthOrigin: `https://${oauthHost}`,
    oauthRedirectUri: `https://${oauthHost}/auth/callback`,
    bootstrapSecret: process.env.RELAY_BOOTSTRAP_SECRET?.trim() ?? '',
    allowedIps: parseAllowedIps(process.env.ALLOWED_IPS),
    inactivityDays: Number(process.env.RELAY_INACTIVITY_DAYS ?? 30),
    cleanupIntervalHours: Number(process.env.RELAY_CLEANUP_INTERVAL_HOURS ?? 6),
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN?.trim() ?? '',
      zoneId: process.env.CLOUDFLARE_ZONE_ID?.trim() ?? '',
      recordType: (process.env.RELAY_DNS_TYPE ?? 'A').toUpperCase(),
      recordTarget: process.env.RELAY_DNS_TARGET?.trim() ?? '',
      proxied: process.env.RELAY_DNS_PROXIED !== 'false',
    },
  };
}

export function instanceHostname(instanceId, baseDomain) {
  return `${instanceId}.${baseDomain}`;
}

export function parseInstanceFromHost(host, baseDomain) {
  const h = (host ?? '').split(':')[0].toLowerCase();
  const suffix = `.${baseDomain}`;
  if (!h.endsWith(suffix)) return null;
  const id = h.slice(0, -suffix.length);
  if (!id || id.includes('.')) return null;
  return id;
}
