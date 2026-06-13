import type { APIRoute } from 'astro';
import { isRelayMode } from '@/env';
import { setConfigValue } from '@/lib/db';
import { registerPartnerAccount } from '@/lib/tesla/auth';
import { checkPartnerPrerequisites, getPartnerSetupHints } from '@/lib/tesla/partner';
import { getStoredRelayInstance, registerRelayPartner } from '@/lib/relay';
import { Agent } from 'node:https';

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
      warnings: ['Run relay setup first'],
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
      warnings: [
        'Partner domain and public key are hosted on the relay.',
        'OAuth uses the shared relay redirect URL — no per-home DNS needed for sign-in.',
      ],
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
      warnings: ['Public key not reachable yet — DNS may still be propagating'],
    };
  }
}

export const GET: APIRoute = async () => {
  try {
    const prerequisites = isRelayMode()
      ? await checkRelayPrerequisites()
      : await checkPartnerPrerequisites();
    return new Response(
      JSON.stringify({
        prerequisites,
        hints: getPartnerSetupHints(),
        relayMode: isRelayMode(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const POST: APIRoute = async () => {
  try {
    if (isRelayMode()) {
      const result = await registerRelayPartner();
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
    }

    const result = await registerPartnerAccount();    return new Response(
      JSON.stringify({
        ok: true,
        registeredRegions: result.registeredRegions,
        prerequisites: result.prerequisites,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Registration failed',
        hints: getPartnerSetupHints(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
