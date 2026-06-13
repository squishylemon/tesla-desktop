import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import { getEnv } from '@/env';
import { getUserTokens } from '@/lib/db';
import { TeslaApiError } from '@/lib/tesla/errors';

export type VehicleCommand =
  | 'door_lock'
  | 'door_unlock'
  | 'actuate_trunk'
  | 'honk_horn'
  | 'flash_lights'
  | 'auto_conditioning_start'
  | 'auto_conditioning_stop'
  | 'set_temps'
  | 'set_charge_limit'
  | 'charge_start'
  | 'charge_stop';

interface CommandBody {
  command: VehicleCommand;
  params?: Record<string, unknown>;
}

const COMMAND_ENDPOINTS: Record<VehicleCommand, string> = {
  door_lock: 'door_lock',
  door_unlock: 'door_unlock',
  actuate_trunk: 'actuate_trunk',
  honk_horn: 'honk_horn',
  flash_lights: 'flash_lights',
  auto_conditioning_start: 'auto_conditioning_start',
  auto_conditioning_stop: 'auto_conditioning_stop',
  set_temps: 'set_temps',
  set_charge_limit: 'set_charge_limit',
  charge_start: 'charge_start',
  charge_stop: 'charge_stop',
};

function getHttpsAgent(): Agent | undefined {
  const { vehicleCommandProxyCa } = getEnv();
  if (!vehicleCommandProxyCa) {
    return new Agent({ rejectUnauthorized: false });
  }
  try {
    const ca = readFileSync(vehicleCommandProxyCa);
    return new Agent({ ca, rejectUnauthorized: true });
  } catch {
    return new Agent({ rejectUnauthorized: false });
  }
}

export async function sendVehicleCommand(
  vin: string,
  command: VehicleCommand,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const tokens = getUserTokens();
  if (!tokens) throw new TeslaApiError('Not authenticated', 401);

  const { vehicleCommandProxyUrl } = getEnv();
  const endpoint = COMMAND_ENDPOINTS[command];
  const url = `${vehicleCommandProxyUrl}/api/1/vehicles/${vin}/command/${endpoint}`;

  const body: CommandBody = { command };
  if (params) body.params = params;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: JSON.stringify(params ?? {}),
    // @ts-expect-error Node fetch supports agent
    agent: getHttpsAgent(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new TeslaApiError(err || `Command failed (${res.status})`, res.status);
  }

  return res.json();
}

export async function sendSignedCommand(vin: string, command: string, payload: unknown): Promise<unknown> {
  const tokens = getUserTokens();
  if (!tokens) throw new TeslaApiError('Not authenticated', 401);

  const { vehicleCommandProxyUrl } = getEnv();
  const url = `${vehicleCommandProxyUrl}/api/1/vehicles/${vin}/signed_command`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: JSON.stringify({ command, payload }),
    // @ts-expect-error Node fetch supports agent
    agent: getHttpsAgent(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new TeslaApiError(err || `Signed command failed (${res.status})`, res.status);
  }

  return res.json();
}
