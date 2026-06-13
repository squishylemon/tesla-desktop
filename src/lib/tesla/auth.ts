import {
  getAudienceUrl,
  PARTNER_TOKEN_SCOPES,
  REGION_BASE_URLS,
  TESLA_AUTH_URL,
  TESLA_SCOPES,
  type TeslaRegion,
} from '@/env';
import { getDeveloperConfig, saveUserTokens, setConfigValue, type UserTokens } from '@/lib/db';
import {
  checkPartnerPrerequisites,
  registerPartnerAccountRegions,
} from '@/lib/tesla/partner';
import { authFetch } from '@/lib/tesla/http';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

function tokensFromResponse(data: TokenResponse): UserTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export function buildAuthorizeUrl(state: string): string {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const audience = getAudienceUrl(config.region);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: TESLA_SCOPES,
    state,
    audience,
  });

  return `${TESLA_AUTH_URL}/oauth2/v3/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<UserTokens> {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const audience = getAudienceUrl(config.region);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    audience,
  });

  const data = await authFetch<TokenResponse>('/oauth2/v3/token', body);
  const tokens = tokensFromResponse(data);
  saveUserTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<UserTokens> {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  });

  const data = await authFetch<TokenResponse>('/oauth2/v3/token', body);
  return tokensFromResponse(data);
}

export async function getPartnerToken(region: TeslaRegion): Promise<string> {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const audience = REGION_BASE_URLS[region];
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: PARTNER_TOKEN_SCOPES,
    audience,
  });

  const data = await authFetch<TokenResponse>('/oauth2/v3/token', body);
  if (!data.access_token) {
    throw new Error(`[${region}] Partner token response missing access_token`);
  }
  return data.access_token;
}

export async function registerPartnerAccount(): Promise<{
  registeredRegions: TeslaRegion[];
  prerequisites: Awaited<ReturnType<typeof checkPartnerPrerequisites>>;
}> {
  const config = getDeveloperConfig();
  if (!config) throw new Error('Developer config not set');

  const prerequisites = await checkPartnerPrerequisites();

  if (prerequisites.needsPublicHost) {
    throw new Error(prerequisites.warnings[0] ?? 'Set a public hostname for partner registration');
  }

  if (!prerequisites.ok) {
    const detail = prerequisites.checks.publicKeyError ?? 'Public key not reachable';
    throw new Error(
      `Public key check failed: ${detail}\nEnsure ${prerequisites.checks.publicKeyUrl} is reachable from the internet (open it in a browser).`,
    );
  }

  const registeredRegions = await registerPartnerAccountRegions();
  setConfigValue('partner_registered', 'true');

  return { registeredRegions, prerequisites };
}
