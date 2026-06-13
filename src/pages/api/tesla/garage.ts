import type { APIRoute } from 'astro';
import { getDeveloperConfig, getUserProfile } from '@/lib/db';
import { getPartnerDomain } from '@/lib/tesla/partner';
import { TeslaApiError } from '@/lib/tesla/errors';
import { getFleetStatus, getCachedVehicleData, listVehicles } from '@/lib/tesla/vehicles';

export const GET: APIRoute = async () => {
  try {
    const config = getDeveloperConfig();
    const vehicles = await listVehicles();
    const vins = vehicles.map((v) => v.vin);
    const fleetStatus = await getFleetStatus(vins);

    const caches: Record<string, { data: unknown; fetchedAt: number }> = {};
    for (const vin of vins) {
      const cached = getCachedVehicleData(vin);
      if (cached) {
        caches[vin] = { data: cached.data, fetchedAt: cached.fetchedAt };
      }
    }

    const user = getUserProfile();

    return new Response(
      JSON.stringify({
        vehicles,
        fleetStatus,
        caches,
        user,
        partnerDomain: config ? getPartnerDomain(config) : null,
        partnerRegistered: config?.partnerRegistered ?? false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {    const status = e instanceof TeslaApiError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to load garage' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
