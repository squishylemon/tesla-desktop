import { getAudienceUrl, type StoredRegion } from '@/env';
import { getDeveloperConfig, getUserTokens, saveUserTokens } from '@/lib/db';
import { TeslaApiError } from '@/lib/tesla/errors';
import { parseFleetResponse } from '@/lib/tesla/http';
import { refreshAccessToken } from '@/lib/tesla/auth';

let refreshPromise: Promise<string> | null = null;

async function getValidAccessToken(): Promise<string> {
  const tokens = getUserTokens();
  if (!tokens) throw new TeslaApiError('Not authenticated', 401);

  const bufferMs = 60_000;
  if (tokens.expiresAt > Date.now() + bufferMs) {
    return tokens.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(tokens.refreshToken)
      .then((newTokens) => {
        saveUserTokens(newTokens);
        return newTokens.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function getFleetBaseUrl(): string {
  const config = getDeveloperConfig();
  return getAudienceUrl((config?.region ?? 'NA') as StoredRegion);
}

export async function fleetFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getValidAccessToken();
  const baseUrl = getFleetBaseUrl();

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  return parseFleetResponse<T>(res);
}

export function getFleetBaseUrlForConfig(): string {
  return getFleetBaseUrl();
}
