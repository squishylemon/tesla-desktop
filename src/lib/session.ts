import type { AstroCookies } from 'astro';
import { generateSessionId } from '@/lib/crypto';
import {
  createSession,
  deleteSession,
  getDeveloperConfig,
  getUserTokens,
  isValidSession,
} from '@/lib/db';

export const SESSION_COOKIE = 'tesla_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createUserSession(cookies: AstroCookies): string {
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  createSession(sessionId, expiresAt);
  cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.ENABLE_HTTPS !== 'false',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return sessionId;
}

export function getSessionId(cookies: AstroCookies): string | null {
  const value = cookies.get(SESSION_COOKIE)?.value;
  if (!value || !isValidSession(value)) return null;
  return value;
}

export function destroySession(cookies: AstroCookies) {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) deleteSession(sessionId);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export type AuthState = 'setup' | 'login' | 'authenticated';

export function getAuthState(): AuthState {
  const devConfig = getDeveloperConfig();
  if (!devConfig) return 'setup';

  const tokens = getUserTokens();
  if (!tokens) return 'login';

  return 'authenticated';
}

export function requireAuth(cookies: AstroCookies): AuthState {
  const state = getAuthState();
  if (state === 'authenticated' && !getSessionId(cookies)) {
    return 'login';
  }
  return state;
}
