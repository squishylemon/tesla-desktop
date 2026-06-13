import type { APIRoute } from 'astro';
import { getCachedVehicleData, getVehicle } from '@/lib/tesla/vehicles';

export const GET: APIRoute = async ({ params }) => {
  const vin = params.vin;
  if (!vin) {
    return new Response(JSON.stringify({ error: 'VIN required' }), { status: 400 });
  }

  try {
    const cached = getCachedVehicleData(vin);
    const vehicle = await getVehicle(vin);
    const lat = cached?.data?.drive_state?.latitude;
    const lng = cached?.data?.drive_state?.longitude;

    if (lat == null || lng == null) {
      return new Response(
        JSON.stringify({ error: 'No location data. Refresh vehicle data first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        latitude: lat,
        longitude: lng,
        heading: cached?.data?.drive_state?.heading,
        online: vehicle.state === 'online',
        config: cached?.data?.vehicle_config,
        fetchedAt: cached?.fetchedAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to load location' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
