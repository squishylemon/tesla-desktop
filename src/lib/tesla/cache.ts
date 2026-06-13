import type { VehicleData } from '@/lib/tesla/types';

export type DataFreshness = 'live' | 'cached' | 'asleep' | 'offline' | 'unknown';

export interface FreshnessInfo {
  status: DataFreshness;
  label: string;
  fetchedAt?: number;
}

const CACHE_STALE_MS = 5 * 60 * 1000;

export function getFreshness(
  vehicleState: string | undefined,
  fetchedAt?: number,
  isLiveFetch = false,
): FreshnessInfo {
  if (isLiveFetch) {
    return { status: 'live', label: 'Live', fetchedAt };
  }

  if (vehicleState === 'asleep') {
    return { status: 'asleep', label: 'Asleep', fetchedAt };
  }

  if (vehicleState === 'offline') {
    return { status: 'offline', label: 'Offline', fetchedAt };
  }

  if (fetchedAt) {
    const ageMs = Date.now() - fetchedAt;
    if (ageMs < CACHE_STALE_MS) {
      const mins = Math.floor(ageMs / 60000);
      const label = mins < 1 ? 'Cached (just now)' : `Cached (${mins}m ago)`;
      return { status: 'cached', label, fetchedAt };
    }
    return { status: 'cached', label: 'Stale — tap Refresh', fetchedAt };
  }

  return { status: 'unknown', label: 'No data' };
}

export function extractSummary(data: VehicleData | null) {
  if (!data) return null;
  return {
    batteryLevel: data.charge_state?.battery_level ?? null,
    batteryRange: data.charge_state?.battery_range ?? null,
    chargingState: data.charge_state?.charging_state ?? null,
    locked: data.vehicle_state?.locked ?? null,
    climateOn: data.climate_state?.is_climate_on ?? null,
    insideTemp: data.climate_state?.inside_temp ?? null,
    outsideTemp: data.climate_state?.outside_temp ?? null,
    odometer: data.vehicle_state?.odometer ?? null,
    software: data.vehicle_state?.car_version ?? null,
    latitude: data.drive_state?.latitude ?? null,
    longitude: data.drive_state?.longitude ?? null,
  };
}
