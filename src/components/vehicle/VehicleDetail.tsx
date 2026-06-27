import { useCallback, useEffect, useState } from 'react';
import BatteryRing from '@/components/vehicle/BatteryRing';
import ChargingPanel from '@/components/vehicle/ChargingPanel';
import ClimatePanel from '@/components/vehicle/ClimatePanel';
import VehicleHero from '@/components/vehicle/VehicleHero';
import { getFreshness } from '@/lib/tesla/cache';
import type { VehicleData, VehicleListItem } from '@/lib/tesla/types';

interface DetailData {
  vehicle: VehicleListItem;
  data: VehicleData | null;
  fetchedAt?: number;
  keyPaired: boolean;
}

interface Props {
  vin: string;
}

export default function VehicleDetail({ vin }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (live = false) => {
    try {
      const url = live ? `/api/tesla/vehicles/${vin}?live=1` : `/api/tesla/vehicles/${vin}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
      setDetail(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vin]);

  useEffect(() => {
    load(true);
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load(true);
  }

  async function sendCommand(command: string, params?: Record<string, unknown>) {
    setCommandLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tesla/vehicles/${vin}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Command failed');
      await load(false);
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

  if (!detail) {
    return <p className="py-24 text-center text-tesla-red">{error ?? 'Vehicle not found'}</p>;
  }

  const { vehicle, data, fetchedAt, keyPaired } = detail;
  const freshness = getFreshness(vehicle.state, fetchedAt);
  const charging = data?.charge_state?.charging_state === 'Charging';
  const name = vehicle.display_name || data?.display_name || 'My Tesla';
  const battery = data?.charge_state?.battery_level ?? 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="capitalize text-tesla-muted">{vehicle.state}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              freshness.status === 'live'
                ? 'tesla-badge-live'
                : freshness.status === 'asleep'
                  ? 'tesla-badge-asleep'
                  : 'tesla-badge-cached'
            }
          >
            {freshness.label}
          </span>
          <button
            type="button"
            className="tesla-btn-secondary px-4 py-2 text-xs"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-tesla-red/50 bg-tesla-red/10 px-4 py-3 text-sm text-tesla-red">
          {error}
        </div>
      )}

      {!keyPaired && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
          Virtual key not paired. Remote commands will not work until you pair in the Tesla app.
        </div>
      )}

      <div className="mb-8">
        <VehicleHero
          config={data?.vehicle_config}
          charging={charging}
          name={name}
        />
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
          {data?.charge_state && (
            <BatteryRing level={battery} charging={charging} />
          )}
          {data?.charge_state?.battery_range != null && (
            <p className="text-tesla-muted">{Math.round(data.charge_state.battery_range)} mi range</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <a href={`/vehicles/${vin}`} className="tesla-btn-secondary px-4 py-2 text-xs bg-white/10">
          Overview
        </a>
        <a href={`/vehicles/${vin}/controls`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Controls
        </a>
        <a href={`/vehicles/${vin}/location`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Location
        </a>
      </div>

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

        <div className="tesla-card">
          <h3 className="mb-4 font-medium">Vehicle</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tesla-muted">Locked</dt>
              <dd>{data?.vehicle_state?.locked != null ? (data.vehicle_state.locked ? 'Yes' : 'No') : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tesla-muted">Sentry</dt>
              <dd>{data?.vehicle_state?.sentry_mode != null ? (data.vehicle_state.sentry_mode ? 'On' : 'Off') : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tesla-muted">Odometer</dt>
              <dd>
                {data?.vehicle_state?.odometer != null
                  ? `${Math.round(data.vehicle_state.odometer).toLocaleString()} mi`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tesla-muted">Software</dt>
              <dd className="truncate max-w-[200px]">{data?.vehicle_state?.car_version ?? '—'}</dd>
            </div>
          </dl>
          {keyPaired && data?.vehicle_state && (
            <button
              type="button"
              className="tesla-btn-secondary mt-4 w-full text-xs"
              disabled={commandLoading}
              onClick={() =>
                sendCommand(data.vehicle_state!.locked ? 'door_unlock' : 'door_lock')
              }
            >
              {data.vehicle_state.locked ? 'Unlock' : 'Lock'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
