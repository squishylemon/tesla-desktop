import type { APIRoute } from 'astro';
import { clearUserTokens } from '@/lib/db';
import { destroySession } from '@/lib/session';

export const POST: APIRoute = async ({ cookies }) => {
  clearUserTokens();
  destroySession(cookies);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
