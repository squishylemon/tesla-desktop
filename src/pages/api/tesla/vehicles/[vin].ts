import type { APIRoute } from 'astro';
import { TeslaApiError } from '@/lib/tesla/errors';
import {
  fetchVehicleData,
  getCachedVehicleData,
  getFleetStatus,
  getVehicle,
} from '@/lib/tesla/vehicles';

export const GET: APIRoute = async ({ params, url }) => {
  const vin = params.vin;
  if (!vin) {
    return new Response(JSON.stringify({ error: 'VIN required' }), { status: 400 });
  }

  try {
    const vehicle = await getVehicle(vin);
    const fleetStatus = await getFleetStatus([vin]);
    const keyPaired = fleetStatus.key_paired_vins.includes(vin);

    const live = url.searchParams.get('live') === '1';
    let data = getCachedVehicleData(vin)?.data ?? null;
    let fetchedAt = getCachedVehicleData(vin)?.fetchedAt;

    if (live) {
      try {
        if (vehicle.state === 'asleep') {
          data = await fetchVehicleData(vin, true);
        } else if (vehicle.state === 'online') {
          data = await fetchVehicleData(vin, false);
        } else {
          const cached = getCachedVehicleData(vin);
          if (!cached) {
            return new Response(
              JSON.stringify({
                vehicle,
                data: null,
                keyPaired,
                error: 'Vehicle is offline. Cached data unavailable.',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }
          data = cached.data;
          fetchedAt = cached.fetchedAt;
        }
        const fresh = getCachedVehicleData(vin);
        fetchedAt = fresh?.fetchedAt;
      } catch (e) {
        if (e instanceof TeslaApiError && e.status === 408) {
          const cached = getCachedVehicleData(vin);
          return new Response(
            JSON.stringify({
              vehicle,
              data: cached?.data ?? null,
              fetchedAt: cached?.fetchedAt,
              keyPaired,
              error: 'Vehicle asleep or unavailable. Showing cached data.',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw e;
      }
    }

    return new Response(
      JSON.stringify({ vehicle, data, fetchedAt, keyPaired }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const status = e instanceof TeslaApiError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to load vehicle' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
