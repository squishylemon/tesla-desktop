import type { APIRoute } from 'astro';
import { isRelayConfigured } from '@/env';
import { setConfigValue } from '@/lib/db';
import { registerPartnerAccount } from '@/lib/tesla/auth';
import { Agent } from 'node:https';
import { getStoredRelayInstance } from '@/lib/relay';

const insecureAgent = new Agent({ rejectUnauthorized: false });

async function checkRelayPrerequisites() {
  const instance = getStoredRelayInstance();
  if (!instance) {
    return {
      ok: false,
      needsPublicHost: false,
      checks: {
        partnerDomain: '',
        publicKeyUrl: '',
        publicKeyReachable: false,
        publicKeyHasPem: false,
        publicKeyError: 'Relay instance not registered',
      },
      warnings: ['Connect to the relay in setup first'],
    };
  }

  try {
    const res = await fetch(instance.publicKeyUrl, {
      signal: AbortSignal.timeout(15_000),
      // @ts-expect-error Node fetch agent
      agent: insecureAgent,
    });
    const text = await res.text();
    const hasPem = text.includes('BEGIN PUBLIC KEY');
    return {
      ok: res.ok && hasPem,
      needsPublicHost: false,
      checks: {
        partnerDomain: instance.partnerDomain,
        publicKeyUrl: instance.publicKeyUrl,
        publicKeyReachable: res.ok,
        publicKeyHasPem: hasPem,
        publicKeyError: res.ok && hasPem ? undefined : `HTTP ${res.status}`,
      },
      warnings: ['Public key is hosted on the relay at your instance subdomain'],
    };
  } catch (e) {
    return {
      ok: false,
      needsPublicHost: false,
      checks: {
        partnerDomain: instance.partnerDomain,
        publicKeyUrl: instance.publicKeyUrl,
        publicKeyReachable: false,
        publicKeyHasPem: false,
        publicKeyError: e instanceof Error ? e.message : 'Fetch failed',
      },
      warnings: ['DNS may still be propagating — wait a few minutes and try again'],
    };
  }
}

export const GET: APIRoute = async () => {
  try {
    const prerequisites = await checkRelayPrerequisites();
    return new Response(JSON.stringify({ prerequisites }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const POST: APIRoute = async () => {
  try {
    if (!isRelayConfigured()) {
      return new Response(JSON.stringify({ error: 'RELAY_API_URL is not configured' }), {
        status: 400,
      });
    }

    const result = await registerPartnerAccount();
    setConfigValue('partner_registered', 'true');
    const prerequisites = await checkRelayPrerequisites();
    return new Response(
      JSON.stringify({
        ok: true,
        registeredRegions: result.registeredRegions,
        prerequisites,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Registration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
