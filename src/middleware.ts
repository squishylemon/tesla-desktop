import { defineMiddleware } from 'astro:middleware';

import { getAuthState, getSessionId, SESSION_COOKIE } from '@/lib/session';
import { isRelayConfigured } from '@/env';
import { relayHeartbeat } from '@/lib/relay';

const PROTECTED_PREFIXES = ['/garage', '/vehicles', '/settings'];

const AUTH_ROUTES = ['/auth/login', '/auth/callback', '/auth/relay-complete'];

let lastRelayHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 12 * 60 * 60 * 1000;

export const onRequest = defineMiddleware(async (context, next) => {
  if (isRelayConfigured() && Date.now() - lastRelayHeartbeat > HEARTBEAT_INTERVAL_MS) {
    lastRelayHeartbeat = Date.now();
    relayHeartbeat().catch(() => {});
  }

  const { pathname } = context.url;


  const authState = getAuthState();

  const hasSession = !!getSessionId(context.cookies);



  if (pathname === '/') {

    if (authState === 'setup') return context.redirect('/setup');

    if (authState === 'login' || !hasSession) return context.redirect('/auth/login');

    return context.redirect('/garage');

  }



  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {

    if (authState === 'setup') return context.redirect('/setup');

    if (authState === 'login' || !hasSession) return context.redirect('/auth/login');

  }



  if (pathname === '/setup' && authState === 'authenticated' && hasSession) {

    return context.redirect('/garage');

  }



  if (pathname === '/auth/login' && authState === 'authenticated' && hasSession) {

    return context.redirect('/garage');

  }



  if (AUTH_ROUTES.includes(pathname) && authState === 'setup') {

    return context.redirect('/setup');

  }



  return next();

});



export { SESSION_COOKIE };

