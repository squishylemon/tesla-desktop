import { getEnv } from '@/env';
import { getConfigValue, setConfigValue } from '@/lib/db';

export interface RelayInstance {
  instanceId: string;
  instanceSecret: string;
  partnerDomain: string;
  redirectUri: string;
  allowedOrigin: string;
  publicKeyUrl: string;
}

export function getStoredRelayInstance(): RelayInstance | null {
  const instanceId = getConfigValue('relay_instance_id');
  const instanceSecret = getConfigValue('relay_instance_secret');
  const partnerDomain = getConfigValue('relay_partner_domain');
  if (!instanceId || !instanceSecret || !partnerDomain) return null;

  const { relayApiUrl } = getEnv();
  return {
    instanceId,
    instanceSecret,
    partnerDomain,
    redirectUri: getConfigValue('relay_redirect_uri') ?? `${relayApiUrl}/auth/callback`,
    allowedOrigin: getConfigValue('relay_allowed_origin') ?? relayApiUrl,
    publicKeyUrl:
      getConfigValue('relay_public_key_url') ??
      `https://${partnerDomain}/.well-known/appspecific/com.tesla.3p.public-key.pem`,
  };
}

export function saveRelayInstance(data: RelayInstance) {
  setConfigValue('relay_instance_id', data.instanceId);
  setConfigValue('relay_instance_secret', data.instanceSecret);
  setConfigValue('relay_partner_domain', data.partnerDomain);
  setConfigValue('relay_redirect_uri', data.redirectUri);
  setConfigValue('relay_allowed_origin', data.allowedOrigin);
  setConfigValue('relay_public_key_url', data.publicKeyUrl);
}

async function relayFetch(path: string, init: RequestInit = {}) {
  const { relayApiUrl } = getEnv();
  if (!relayApiUrl) throw new Error('RELAY_API_URL is not configured');

  const res = await fetch(`${relayApiUrl}${path}`, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    const msg =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `Relay error (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export async function registerRelayInstance(): Promise<RelayInstance> {
  const { relayBootstrapSecret } = getEnv();
  const data = (await relayFetch('/api/v1/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      relayBootstrapSecret ? { bootstrapSecret: relayBootstrapSecret } : {},
    ),
  })) as RelayInstance & { instanceSecret: string };

  const instance: RelayInstance = {
    instanceId: data.instanceId,
    instanceSecret: data.instanceSecret,
    partnerDomain: data.partnerDomain,
    redirectUri: data.redirectUri,
    allowedOrigin: data.allowedOrigin,
    publicKeyUrl: data.publicKeyUrl,
  };
  saveRelayInstance(instance);
  return instance;
}

export async function relayHeartbeat(): Promise<void> {
  const instance = getStoredRelayInstance();
  if (!instance) return;

  await relayFetch(`/api/v1/instances/${instance.instanceId}/heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instance.instanceSecret}` },
  });
}

export async function uploadRelayPublicKey(publicKeyPem: string): Promise<void> {
  const instance = getStoredRelayInstance();
  if (!instance) throw new Error('Relay instance not registered');

  await relayFetch(`/api/v1/instances/${instance.instanceId}/public-key`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${instance.instanceSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicKeyPem }),
  });
}
