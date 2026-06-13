import type { APIRoute } from 'astro';
import { sendVehicleCommand, type VehicleCommand } from '@/lib/tesla/commands';
import { TeslaApiError } from '@/lib/tesla/errors';
import { getFleetStatus } from '@/lib/tesla/vehicles';

const ALLOWED_COMMANDS: VehicleCommand[] = [
  'door_lock',
  'door_unlock',
  'actuate_trunk',
  'honk_horn',
  'flash_lights',
  'auto_conditioning_start',
  'auto_conditioning_stop',
  'set_temps',
  'set_charge_limit',
  'charge_start',
  'charge_stop',
];

export const POST: APIRoute = async ({ params, request }) => {
  const vin = params.vin;
  if (!vin) {
    return new Response(JSON.stringify({ error: 'VIN required' }), { status: 400 });
  }

  try {
    const fleetStatus = await getFleetStatus([vin]);
    if (!fleetStatus.key_paired_vins.includes(vin)) {
      return new Response(JSON.stringify({ error: 'Virtual key not paired' }), { status: 403 });
    }

    const body = (await request.json()) as { command: VehicleCommand; params?: Record<string, unknown> };
    if (!ALLOWED_COMMANDS.includes(body.command)) {
      return new Response(JSON.stringify({ error: 'Command not allowed' }), { status: 400 });
    }

    const result = await sendVehicleCommand(vin, body.command, body.params);
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const status = e instanceof TeslaApiError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Command failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
