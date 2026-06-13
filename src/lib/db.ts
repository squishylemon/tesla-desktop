import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEnv, isRelayMode, resolveRegion, resolveRedirectUri, normalizeAppDomain, isStaleTunnelDomain, type StoredRegion, type TeslaRegion } from '@/env';
import { decrypt, encrypt } from '@/lib/crypto';

export interface DeveloperConfig {
  clientId: string;
  clientSecret: string;
  region: TeslaRegion;
  redirectUri: string;
  domain: string;
  partnerRegistered: boolean;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserProfile {
  email?: string;
  fullName?: string;
}

interface Store {
  config: Record<string, string>;
  userTokens: {
    access_token_enc: string;
    refresh_token_enc: string;
    expires_at: number;
    updated_at: number;
  } | null;
  userProfile: {
    email: string | null;
    full_name: string | null;
    updated_at: number;
  } | null;
  vehicleCache: Record<string, { data_json: string; fetched_at: number; state: string | null }>;
  sessions: Record<string, { created_at: number; expires_at: number }>;
}

const DEFAULT_STORE: Store = {
  config: {},
  userTokens: null,
  userProfile: null,
  vehicleCache: {},
  sessions: {},
};

let store: Store | null = null;

function getStorePath(): string {
  const { dataDir } = getEnv();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, 'tesla-desktop.json');
}

function loadStore(): Store {
  if (store) return store;
  const path = getStorePath();
  if (!existsSync(path)) {
    store = structuredClone(DEFAULT_STORE);
    persist();
    return store;
  }
  store = JSON.parse(readFileSync(path, 'utf8')) as Store;
  return store;
}

function persist() {
  if (!store) return;
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
}

export function getConfigValue(key: string): string | null {
  return loadStore().config[key] ?? null;
}

export function setConfigValue(key: string, value: string) {
  const s = loadStore();
  s.config[key] = value;
  persist();
}

export function getDeveloperConfig(): DeveloperConfig | null {
  const clientId = getConfigValue('client_id');
  const clientSecret = getConfigValue('client_secret');
  const rawRegion = getConfigValue('region') as StoredRegion | null;
  if (!clientId || !clientSecret || !rawRegion) return null;

  const region = resolveRegion(rawRegion);
  if (rawRegion === 'AP') {
    setConfigValue('region', region);
  }

  const { domain: envDomain } = getEnv();
  let storedDomain = normalizeAppDomain(getConfigValue('domain') ?? envDomain);

  if (isRelayMode()) {
    const relayDomain = getConfigValue('relay_partner_domain');
    const relayRedirect = getConfigValue('relay_redirect_uri');
    if (relayDomain) storedDomain = normalizeAppDomain(relayDomain);

    return {
      clientId,
      clientSecret,
      region,
      redirectUri: relayRedirect ?? resolveRedirectUri(storedDomain),
      domain: storedDomain,
      partnerRegistered: getConfigValue('partner_registered') === 'true',
    };
  }

  if (isStaleTunnelDomain(storedDomain)) {
    storedDomain = normalizeAppDomain(envDomain);
    setConfigValue('domain', storedDomain);
  }

  const storeData = loadStore();
  if ('public_url' in storeData.config) {
    delete storeData.config.public_url;
    persist();
  }

  const canonicalRedirect = resolveRedirectUri(storedDomain);
  if (getConfigValue('redirect_uri') !== canonicalRedirect) {
    setConfigValue('redirect_uri', canonicalRedirect);
  }

  return {
    clientId,
    clientSecret,
    region,
    redirectUri: canonicalRedirect,
    domain: storedDomain,
    partnerRegistered: getConfigValue('partner_registered') === 'true',
  };
}

export function saveDeveloperConfig(
  config: Omit<DeveloperConfig, 'partnerRegistered'> & { partnerRegistered?: boolean },
) {
  setConfigValue('client_id', config.clientId);
  setConfigValue('client_secret', config.clientSecret);
  setConfigValue('region', config.region);
  setConfigValue('redirect_uri', config.redirectUri);
  setConfigValue('domain', config.domain);
  if (config.partnerRegistered !== undefined) {
    setConfigValue('partner_registered', config.partnerRegistered ? 'true' : 'false');
  }
}

export function saveUserTokens(tokens: UserTokens) {
  const s = loadStore();
  s.userTokens = {
    access_token_enc: encrypt(tokens.accessToken),
    refresh_token_enc: encrypt(tokens.refreshToken),
    expires_at: tokens.expiresAt,
    updated_at: Date.now(),
  };
  persist();
}

export function getUserTokens(): UserTokens | null {
  const row = loadStore().userTokens;
  if (!row) return null;
  try {
    return {
      accessToken: decrypt(row.access_token_enc),
      refreshToken: decrypt(row.refresh_token_enc),
      expiresAt: row.expires_at,
    };
  } catch {
    // Tokens were encrypted with a different SESSION_SECRET (e.g. after .env change).
    clearUserTokens();
    return null;
  }
}

export function clearUserTokens() {
  const s = loadStore();
  s.userTokens = null;
  s.userProfile = null;
  s.vehicleCache = {};
  persist();
}

export function saveUserProfile(profile: UserProfile) {
  const s = loadStore();
  s.userProfile = {
    email: profile.email ?? null,
    full_name: profile.fullName ?? null,
    updated_at: Date.now(),
  };
  persist();
}

export function getUserProfile(): UserProfile | null {
  const row = loadStore().userProfile;
  if (!row) return null;
  return { email: row.email ?? undefined, fullName: row.full_name ?? undefined };
}

export function saveVehicleCache(vin: string, data: unknown, state?: string) {
  const s = loadStore();
  s.vehicleCache[vin] = {
    data_json: JSON.stringify(data),
    fetched_at: Date.now(),
    state: state ?? null,
  };
  persist();
}

export function getVehicleCache(vin: string): { data: unknown; fetchedAt: number; state?: string } | null {
  const row = loadStore().vehicleCache[vin];
  if (!row) return null;
  return {
    data: JSON.parse(row.data_json),
    fetchedAt: row.fetched_at,
    state: row.state ?? undefined,
  };
}

export function createSession(sessionId: string, expiresAt: number) {
  const s = loadStore();
  s.sessions[sessionId] = { created_at: Date.now(), expires_at: expiresAt };
  persist();
}

export function isValidSession(sessionId: string): boolean {
  const row = loadStore().sessions[sessionId];
  return !!row && row.expires_at > Date.now();
}

export function deleteSession(sessionId: string) {
  const s = loadStore();
  delete s.sessions[sessionId];
  persist();
}

export function deleteAllSessions() {
  const s = loadStore();
  s.sessions = {};
  persist();
}

// Kept for compatibility if anything imports getDb
export function getDb(): never {
  throw new Error('Use file-based store functions directly');
}
