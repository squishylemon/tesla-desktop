import type { APIRoute } from 'astro';
import { ensureKeyPair, getPublicKeyContent } from '@/lib/keys';
import {
  getStoredRelayInstance,
  registerRelayInstance,
  relayHeartbeat,
  uploadRelayPublicKey,
} from '@/lib/relay';
import { isRelayConfigured } from '@/env';

export const POST: APIRoute = async () => {
  if (!isRelayConfigured()) {
    return new Response(JSON.stringify({ error: 'RELAY_API_URL is not configured' }), {
      status: 400,
    });
  }

  try {
    let instance = getStoredRelayInstance();
    if (!instance) {
      instance = await registerRelayInstance();
    }

    ensureKeyPair();
    const publicKey = getPublicKeyContent();
    if (publicKey) {
      await uploadRelayPublicKey(publicKey);
    }

    await relayHeartbeat();

    return new Response(
      JSON.stringify({
        ok: true,
        instanceId: instance.instanceId,
        partnerDomain: instance.partnerDomain,
        redirectUri: instance.redirectUri,
        allowedOrigin: instance.allowedOrigin,
        publicKeyUrl: instance.publicKeyUrl,
      }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Relay registration failed' }),
      { status: 500 },
    );
  }
};
