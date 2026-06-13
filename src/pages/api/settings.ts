import type { APIRoute } from 'astro';
import { getDeveloperConfig, getUserProfile } from '@/lib/db';
import { getPartnerDomain } from '@/lib/tesla/partner';
import { getPublicKeyUrl } from '@/lib/keys';

export const GET: APIRoute = async () => {
  const config = getDeveloperConfig();
  const user = getUserProfile();
  const publicKeyUrl = config ? getPublicKeyUrl() : undefined;
  const partnerDomain = config ? getPartnerDomain(config) : undefined;

  return new Response(
    JSON.stringify({ config, user, publicKeyUrl, partnerDomain }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};