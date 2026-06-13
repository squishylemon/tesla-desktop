import type { APIRoute } from 'astro';
import type { TeslaRegion } from '@/env';
import { isRelayConfigured } from '@/env';
import { saveDeveloperConfig } from '@/lib/db';
import { ensureKeyPair } from '@/lib/keys';
import { getStoredRelayInstance } from '@/lib/relay';

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isRelayConfigured()) {
      return new Response(JSON.stringify({ error: 'RELAY_API_URL is not configured' }), {
        status: 400,
      });
    }

    const instance = getStoredRelayInstance();
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Connect to the relay first' }), { status: 400 });
    }

    const body = (await request.json()) as {
      clientId: string;
      clientSecret: string;
      region: TeslaRegion;
    };

    if (!body.clientId || !body.clientSecret || !body.region) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    saveDeveloperConfig({
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      region: body.region,
      redirectUri: instance.redirectUri,
      domain: instance.partnerDomain,
      partnerRegistered: false,
    });

    ensureKeyPair();

    return new Response(
      JSON.stringify({
        ok: true,
        redirectUri: instance.redirectUri,
        domain: instance.partnerDomain,
      }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to save' }),
      { status: 500 },
    );
  }
};
