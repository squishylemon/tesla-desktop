import { Agent } from 'node:https';
import { REGION_BASE_URLS, type TeslaRegion } from '@/env';
import { getDeveloperConfig, type DeveloperConfig } from '@/lib/db';
import { getPartnerToken } from '@/lib/tesla/auth';
import { readTeslaError } from '@/lib/tesla/response';

const PUBLIC_KEY_PATH = '/.well-known/appspecific/com.tesla.3p.public-key.pem';

const insecureAgent = new Agent({ rejectUnauthorized: false });

/** Domain for partner_accounts — no protocol, no port, lowercase */
export function normalizePartnerDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/+$/, '');

  const ipv6 = d.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (ipv6) return ipv6[1];

  const lastColon = d.lastIndexOf(':');
  if (lastColon > -1 && /^\d+$/.test(d.slice(lastColon + 1))) {
    d = d.slice(0, lastColon);
  }

  return d;
}

export function getAppOrigin(config?: DeveloperConfig | null): string {
  const c = config ?? getDeveloperConfig();
  if (!c) return 'https://localhost:4321';
  return getPublicOrigin(c.redirectUri);
}

export function getPublicOrigin(redirectUri?: string): string {
  const uri = redirectUri ?? getDeveloperConfig()?.redirectUri ?? 'https://localhost:4321/auth/callback';
  try {
    return new URL(uri).origin;
  } catch {
    return 'https://localhost:4321';
  }
}

export function getPartnerDomain(config?: DeveloperConfig | null): string {
  const c = config ?? getDeveloperConfig();
  if (!c) return 'localhost';
  return normalizePartnerDomain(c.domain);
}

export function getPublicKeyCheckUrl(config?: DeveloperConfig | null): string {
  return `${getAppOrigin(config)}${PUBLIC_KEY_PATH}`;
}

export function isLocalPartnerDomain(domain: string): boolean {
  const d = normalizePartnerDomain(domain);
  return d === 'localhost' || d === '127.0.0.1' || d.endsWith('.localhost');
}

export const PARTNER_SETUP_MESSAGE = `Partner registration uses your relay instance subdomain.

Complete setup: connect to the relay, add the shown URLs to developer.tesla.com, then register domain.`;

async function fetchPublicKey(url: string): Promise<{ ok: boolean; hasPem: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
      // @ts-expect-error Node fetch supports https agent
      agent: insecureAgent,
    });
    const text = await res.text();
    const hasPem = text.includes('BEGIN PUBLIC KEY');
    if (!res.ok) {
      return { ok: false, hasPem, error: `HTTP ${res.status}` };
    }
    if (!hasPem) {
      return { ok: false, hasPem, error: 'Response is not a PEM public key' };
    }
    return { ok: true, hasPem };
  } catch (e) {
    return {
      ok: false,
      hasPem: false,
      error: e instanceof Error ? e.message : 'Fetch failed',
    };
  }
}

export interface PartnerPrerequisiteResult {
  ok: boolean;
  needsPublicHost: boolean;
  checks: {
    partnerDomain: string;
    publicKeyUrl: string;
    publicKeyReachable: boolean;
    publicKeyHasPem: boolean;
    publicKeyError?: string;
  };
  warnings: string[];
}

export async function checkPartnerPrerequisites(): Promise<PartnerPrerequisiteResult> {
  const config = getDeveloperConfig();
  if (!config) {
    throw new Error('Developer config not set');
  }

  const partnerDomain = getPartnerDomain(config);
  const publicKeyUrl = getPublicKeyCheckUrl(config);
  const needsPublicHost = isLocalPartnerDomain(partnerDomain);
  const warnings: string[] = [];

  if (needsPublicHost) {
    warnings.push(PARTNER_SETUP_MESSAGE);
  } else {
    warnings.push(
      'Tesla servers must fetch your public key from the internet. Port-forward 4321 to this machine if you are self-hosting at home.',
    );
  }

  const local = await fetchPublicKey(publicKeyUrl);

  return {
    ok: local.ok && local.hasPem && !needsPublicHost,
    needsPublicHost,
    checks: {
      partnerDomain,
      publicKeyUrl,
      publicKeyReachable: local.ok,
      publicKeyHasPem: local.hasPem,
      publicKeyError: local.error,
    },
    warnings,
  };
}

export async function registerPartnerInRegion(region: TeslaRegion, domain: string): Promise<void> {
  const partnerDomain = normalizePartnerDomain(domain);

  if (isLocalPartnerDomain(partnerDomain)) {
    throw new Error(PARTNER_SETUP_MESSAGE);
  }

  const partnerToken = await getPartnerToken(region);
  const baseUrl = REGION_BASE_URLS[region];

  const res = await fetch(`${baseUrl}/api/1/partner_accounts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({ domain: partnerDomain }),
  });

  if (res.ok) {
    return;
  }

  const message = await readTeslaError(res, 'Partner registration failed');

  if (res.status === 409 || /already registered|duplicate|exists/i.test(message)) {
    return;
  }

  throw new Error(`[${region}] ${message}`);
}

export async function registerPartnerAccountRegions(): Promise<TeslaRegion[]> {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const partnerDomain = getPartnerDomain(config);
  const { PARTNER_REGISTRATION_REGIONS, resolveRegion } = await import('@/env');
  const userRegion = resolveRegion(config.region);
  const regionsToRegister =
    userRegion === 'CN' ? (['CN'] as TeslaRegion[]) : PARTNER_REGISTRATION_REGIONS;

  const errors: string[] = [];
  const registered: TeslaRegion[] = [];

  for (const region of regionsToRegister) {
    try {
      await registerPartnerInRegion(region, partnerDomain);
      registered.push(region);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `[${region}] registration failed`);
    }
  }

  if (registered.length === 0) {
    throw new Error(errors.join('\n') || 'Partner registration failed in all regions');
  }

  return registered;
}

export function getPartnerSetupHints(): string[] {
  const config = getDeveloperConfig();
  if (!config) return [];

  const partnerDomain = getPartnerDomain(config);
  const publicKeyUrl = getPublicKeyCheckUrl(config);

  return [
    `Partner domain: ${partnerDomain}`,
    `App origin: ${getAppOrigin(config)}`,
    `Public key URL: ${publicKeyUrl}`,
    'developer.tesla.com — Allowed Origin and Redirect URL must match your HTTPS origin',
    'Accept the self-signed certificate in your browser when visiting the app',
    'Port-forward TCP 4321 if hosting at home so Tesla can verify your public key',
    'Click Register Domain in /setup (registers NA + EU)',
  ];
}
