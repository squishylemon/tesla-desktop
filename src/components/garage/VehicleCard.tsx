import { getFreshness } from '@/lib/tesla/cache';
import { getVehiclePlaceholder } from '@/lib/tesla/vehicle-images';
import type { VehicleData, VehicleListItem } from '@/lib/tesla/types';

interface Props {
  vehicle: VehicleListItem;
  cache?: { data: VehicleData; fetchedAt: number };
  keyPaired: boolean;
}

export default function VehicleCard({ vehicle, cache, keyPaired }: Props) {
  const data = cache?.data;
  const config = data?.vehicle_config;
  const charging = data?.charge_state?.charging_state === 'Charging';
  const image = getVehiclePlaceholder(config, charging);
  const freshness = getFreshness(vehicle.state, cache?.fetchedAt);

  const battery = data?.charge_state?.battery_level ?? null;
  const range = data?.charge_state?.battery_range ?? null;
  const name = vehicle.display_name || data?.display_name || 'My Tesla';

  const badgeClass =
    freshness.status === 'live'
      ? 'tesla-badge-live'
      : freshness.status === 'asleep'
        ? 'tesla-badge-asleep'
        : freshness.status === 'offline'
          ? 'tesla-badge-offline'
          : 'tesla-badge-cached';

  return (
    <a href={`/vehicles/${vehicle.vin}`} className="tesla-card group block transition-colors hover:border-white/20">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium">{name}</h2>
          <p className="text-sm capitalize text-tesla-muted">{vehicle.state}</p>
        </div>
        <span className={badgeClass}>{freshness.label}</span>
      </div>

      <div className="relative flex h-40 items-center justify-center overflow-hidden">
        <img
          src={image}
          alt={name}
          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105 animate-float"
        />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          {battery !== null && (
            <p className="text-2xl font-semibold">
              {battery}
              <span className="text-base font-normal text-tesla-muted">%</span>
            </p>
          )}
          {range !== null && (
            <p className="text-sm text-tesla-muted">{Math.round(range)} mi</p>
          )}
          {battery === null && (
            <p className="text-sm text-tesla-muted">Tap to load data</p>
          )}
        </div>
        {!keyPaired && (
          <span className="text-xs text-yellow-500">Key not paired</span>
        )}
      </div>
    </a>
  );
}
