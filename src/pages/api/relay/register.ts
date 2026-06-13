import type { APIRoute } from 'astro';
import { isRelayMode } from '@/env';
import { saveDeveloperConfig } from '@/lib/db';
import { ensureKeyPair, getPublicKeyContent } from '@/lib/keys';
import {
  getStoredRelayInstance,
  registerRelayInstance,
  relayHeartbeat,
  uploadRelayPublicKey,
} from '@/lib/relay';
import { getEnv } from '@/env';

export const POST: APIRoute = async () => {
  if (!isRelayMode()) {
    return new Response(JSON.stringify({ error: 'Relay mode is not enabled' }), { status: 400 });
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

    const { relaySharedClientId, relaySharedClientSecret, relaySharedRegion } = getEnv();
    if (!relaySharedClientId || !relaySharedClientSecret) {
      return new Response(
        JSON.stringify({
          error: 'RELAY_SHARED_CLIENT_ID and RELAY_SHARED_CLIENT_SECRET must be set',
        }),
        { status: 500 },
      );
    }

    saveDeveloperConfig({
      clientId: relaySharedClientId,
      clientSecret: relaySharedClientSecret,
      region: relaySharedRegion,
      redirectUri: instance.redirectUri,
      domain: instance.partnerDomain,
      partnerRegistered: false,
    });

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
