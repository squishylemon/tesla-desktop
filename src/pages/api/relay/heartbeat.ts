import type { APIRoute } from 'astro';
import { relayHeartbeat } from '@/lib/relay';

export const POST: APIRoute = async () => {
  try {
    await relayHeartbeat();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Heartbeat failed' }),
      { status: 500 },
    );
  }
};
