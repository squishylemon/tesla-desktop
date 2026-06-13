import { TESLA_AUTH_URL } from '@/env';
import { TeslaApiError } from '@/lib/tesla/errors';
import { formatTeslaError, readTeslaError } from '@/lib/tesla/response';

export async function authFetch<T>(path: string, body: URLSearchParams): Promise<T> {
  const res = await fetch(`${TESLA_AUTH_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const message = await readTeslaError(res, 'Auth request failed');
    throw new TeslaApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export async function parseFleetResponse<T>(res: Response): Promise<T> {
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? res.headers.get('RateLimit-Reset') ?? 60);
    throw new TeslaApiError('Rate limited', 429, retryAfter);
  }

  const text = await res.text();
  let body: { response?: T; error?: string; error_description?: string } = {};

  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new TeslaApiError(text || `Request failed (${res.status})`, res.status);
      }
    }
  }

  if (!res.ok) {
    throw new TeslaApiError(formatTeslaError(body, res.status, 'Request failed'), res.status);
  }

  return body.response as T;
}
