import { useCallback, useEffect, useState } from 'react';
import ClimatePanel from '@/components/vehicle/ClimatePanel';
import ChargingPanel from '@/components/vehicle/ChargingPanel';
import VirtualKeyPairing from '@/components/vehicle/VirtualKeyPairing';
import type { VehicleData, VehicleListItem } from '@/lib/tesla/types';

interface Props {
  vin: string;
}

export default function VehicleControls({ vin }: Props) {
  const [vehicle, setVehicle] = useState<VehicleListItem | null>(null);
  const [data, setData] = useState<VehicleData | null>(null);
  const [keyPaired, setKeyPaired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commandLoading, setCommandLoading] = useState(false);
  const [temp, setTemp] = useState(22);
  const [chargeLimit, setChargeLimit] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [partnerDomain, setPartnerDomain] = useState<string | null>(null);
  const [partnerRegistered, setPartnerRegistered] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tesla/vehicles/${vin}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
      const json = await res.json();
      setVehicle(json.vehicle);
      setData(json.data);
      setKeyPaired(json.keyPaired);
      if (json.data?.climate_state?.driver_temp_setting) {
        setTemp(json.data.climate_state.driver_temp_setting);
      }
      if (json.data?.charge_state?.charge_limit_soc) {
        setChargeLimit(json.data.charge_state.charge_limit_soc);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [vin]);

  useEffect(() => {
    load();
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        setPartnerDomain(s.partnerDomain ?? s.config?.domain ?? null);
        setPartnerRegistered(s.config?.partnerRegistered ?? false);
      })
      .catch(() => undefined);
  }, [load]);

  async function sendCommand(command: string, params?: Record<string, unknown>) {
    if (!keyPaired) {
      setError('Virtual key not paired');
      return;
    }
    setCommandLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tesla/vehicles/${vin}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Command failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Command failed');
    } finally {
      setCommandLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-24">
        <img src="/imgs/spinner.png" alt="" className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const name = vehicle?.display_name || data?.display_name || 'My Tesla';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-tesla-muted">Controls</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <a href={`/vehicles/${vin}`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Overview
        </a>
        <a href={`/vehicles/${vin}/controls`} className="tesla-btn-secondary px-4 py-2 text-xs bg-white/10">
          Controls
        </a>
        <a href={`/vehicles/${vin}/location`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Location
        </a>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-tesla-red/50 bg-tesla-red/10 px-4 py-3 text-sm text-tesla-red">
          {error}
        </div>
      )}

      {!keyPaired && partnerDomain && (
        <div className="mb-6">
          <VirtualKeyPairing
            partnerDomain={partnerDomain}
            partnerRegistered={partnerRegistered}
            vin={vin}
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ClimatePanel
          climate={data?.climate_state}
          onToggle={keyPaired ? (on) => sendCommand(on ? 'auto_conditioning_start' : 'auto_conditioning_stop') : undefined}
          loading={commandLoading}
        />
        <ChargingPanel
          charge={data?.charge_state}
          onStart={keyPaired ? () => sendCommand('charge_start') : undefined}
          onStop={keyPaired ? () => sendCommand('charge_stop') : undefined}
          loading={commandLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="tesla-card space-y-4">
          <h3 className="font-medium">Set Temperature</h3>
          <input
            type="range"
            min={15}
            max={30}
            step={0.5}
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full"
            disabled={!keyPaired}
          />
          <p className="text-center text-xl">{temp}°C</p>
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={!keyPaired || commandLoading}
            onClick={() => sendCommand('set_temps', { driver_temp: temp, passenger_temp: temp })}
          >
            Apply Temperature
          </button>
        </div>

        <div className="tesla-card space-y-4">
          <h3 className="font-medium">Charge Limit</h3>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={chargeLimit}
            onChange={(e) => setChargeLimit(Number(e.target.value))}
            className="w-full"
            disabled={!keyPaired}
          />
          <p className="text-center text-xl">{chargeLimit}%</p>
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={!keyPaired || commandLoading}
            onClick={() => sendCommand('set_charge_limit', { percent: chargeLimit })}
          >
            Set Charge Limit
          </button>
        </div>

        <div className="tesla-card space-y-3 md:col-span-2">
          <h3 className="font-medium">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="tesla-btn-secondary text-xs"
              disabled={!keyPaired || commandLoading}
              onClick={() => sendCommand(data?.vehicle_state?.locked ? 'door_unlock' : 'door_lock')}
            >
              {data?.vehicle_state?.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              type="button"
              className="tesla-btn-secondary text-xs"
              disabled={!keyPaired || commandLoading}
              onClick={() => sendCommand('actuate_trunk', { which_trunk: 'front' })}
            >
              Frunk
            </button>
            <button
              type="button"
              className="tesla-btn-secondary text-xs"
              disabled={!keyPaired || commandLoading}
              onClick={() => sendCommand('actuate_trunk', { which_trunk: 'rear' })}
            >
              Trunk
            </button>
            <button
              type="button"
              className="tesla-btn-secondary text-xs"
              disabled={!keyPaired || commandLoading}
              onClick={() => sendCommand('honk_horn')}
            >
              Honk
            </button>
            <button
              type="button"
              className="tesla-btn-secondary text-xs"
              disabled={!keyPaired || commandLoading}
              onClick={() => sendCommand('flash_lights')}
            >
              Flash Lights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
