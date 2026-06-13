import type { APIRoute } from 'astro';
import { TeslaApiError } from '@/lib/tesla/errors';
import { fetchVehicleData } from '@/lib/tesla/vehicles';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { vin, wake } = (await request.json()) as { vin: string; wake?: boolean };
    if (!vin) {
      return new Response(JSON.stringify({ error: 'VIN required' }), { status: 400 });
    }

    const data = await fetchVehicleData(vin, wake ?? false);
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const status = e instanceof TeslaApiError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Refresh failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
