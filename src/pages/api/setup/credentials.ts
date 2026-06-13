import type { APIRoute } from 'astro';
import type { TeslaRegion } from '@/env';
import { getEnv, resolveRedirectUri } from '@/env';
import { saveDeveloperConfig } from '@/lib/db';
import { ensureKeyPair } from '@/lib/keys';
import { normalizePartnerDomain } from '@/lib/tesla/partner';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as {
      clientId: string;
      clientSecret: string;
      region: TeslaRegion;
      domain?: string;
    };

    if (!body.clientId || !body.clientSecret || !body.region) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const domain = normalizePartnerDomain(body.domain || getEnv().domain);
    const redirectUri = resolveRedirectUri(domain);

    saveDeveloperConfig({
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      region: body.region,
      redirectUri,
      domain,
      partnerRegistered: false,
    });

    ensureKeyPair();

    return new Response(JSON.stringify({ ok: true, redirectUri, domain }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to save' }),
      { status: 500 },
    );
  }
};
