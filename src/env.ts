/**
 * Tesla Fleet API regional base URLs (audience values for OAuth).
 * @see https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries
 *
 * Asia-Pacific (AU, JP, KR, etc.) uses the NA endpoint — there is no separate AP audience.
 */
export type TeslaRegion = 'NA' | 'EU' | 'CN';

/** @deprecated Stored configs may still have AP; treated as NA */
export type StoredRegion = TeslaRegion | 'AP';

export const REGION_BASE_URLS: Record<TeslaRegion, string> = {
  NA: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  EU: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
  CN: 'https://fleet-api.prd.cn.vn.cloud.tesla.cn',
};

/** Partner registration targets — register on both for maximum compatibility */
export const PARTNER_REGISTRATION_REGIONS: TeslaRegion[] = ['NA', 'EU'];

export const REGION_OPTIONS: {
  value: TeslaRegion;
  label: string;
  description: string;
}[] = [
  {
    value: 'NA',
    label: 'North America & Asia-Pacific',
    description: 'US, CA, MX, AU, JP, KR, NZ, and other AP countries (excl. China)',
  },
  {
    value: 'EU',
    label: 'Europe, Middle East & Africa',
    description: 'GB, DE, FR, NL, NO, and other European countries',
  },
  {
    value: 'CN',
    label: 'China',
    description: 'Requires a separate app at developer.tesla.cn',
  },
];

export const TESLA_AUTH_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com';

export const TESLA_SCOPES = [
  'openid',
  'offline_access',
  'user_data',
  'vehicle_device_data',
  'vehicle_location',
  'vehicle_cmds',
  'vehicle_charging_cmds',
].join(' ');

/** Scopes for partner client_credentials token (no offline_access) */
export const PARTNER_TOKEN_SCOPES = [
  'openid',
  'user_data',
  'vehicle_device_data',
  'vehicle_location',
  'vehicle_cmds',
  'vehicle_charging_cmds',
].join(' ');

/** Normalize legacy AP selection and return the Fleet API audience URL */
export function resolveRegion(region: StoredRegion): TeslaRegion {
  if (region === 'AP') return 'NA';
  return region;
}

export function getAudienceUrl(region: StoredRegion): string {
  return REGION_BASE_URLS[resolveRegion(region)];
}

/** Hostname only — strips protocol and port */
export function normalizeAppDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const ipv6 = d.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (ipv6) return ipv6[1];

  const lastColon = d.lastIndexOf(':');
  if (lastColon > -1 && /^\d+$/.test(d.slice(lastColon + 1))) {
    d = d.slice(0, lastColon);
  }

  return d;
}

export function isStaleTunnelDomain(domain: string): boolean {
  const d = normalizeAppDomain(domain);
  return d.endsWith('.trycloudflare.com') || d.includes('cloudflare');
}

/** OAuth redirect URI from current env + domain (ignores stale persisted tunnel URLs). */
export function resolveRedirectUri(domain?: string): string {
  const { redirectUri, port, domain: envDomain } = getEnv();
  if (process.env.TESLA_REDIRECT_URI?.trim()) {
    return redirectUri;
  }
  const d = normalizeAppDomain(domain ?? envDomain);
  const host = d === '0.0.0.0' ? 'localhost' : d;
  return `https://${host}:${port}/auth/callback`;
}

export function getEnv() {
  const tlsHostname = process.env.TESLA_TLS_HOSTNAME ?? process.env.TESLA_DOMAIN ?? 'localhost';
  const port = Number(process.env.PORT ?? 4321);
  const domain = process.env.TESLA_DOMAIN ?? tlsHostname;
  const defaultOrigin = `https://${tlsHostname === '0.0.0.0' ? 'localhost' : tlsHostname}:${port}`;

  return {
    host: process.env.HOST ?? '0.0.0.0',
    port,
    dataDir: process.env.DATA_DIR ?? './data',
    tlsHostname,
    enableHttps: process.env.ENABLE_HTTPS !== 'false',
    redirectUri: process.env.TESLA_REDIRECT_URI ?? `${defaultOrigin}/auth/callback`,
    domain,
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-change-in-production',
    vehicleCommandProxyUrl:
      process.env.VEHICLE_COMMAND_PROXY_URL ?? 'https://localhost:4443',
    vehicleCommandProxyCa: process.env.VEHICLE_COMMAND_PROXY_CA ?? '',
    relayApiUrl: process.env.RELAY_API_URL?.trim().replace(/\/+$/, '') ?? '',
    relayBootstrapSecret: process.env.RELAY_BOOTSTRAP_SECRET?.trim() ?? '',
    relaySharedClientId: process.env.RELAY_SHARED_CLIENT_ID?.trim() ?? '',
    relaySharedClientSecret: process.env.RELAY_SHARED_CLIENT_SECRET?.trim() ?? '',
    relaySharedRegion: (process.env.RELAY_SHARED_REGION ?? 'NA') as TeslaRegion,
  };
}

export function isRelayMode(): boolean {
  return !!getEnv().relayApiUrl;
}
