import { fleetFetch } from '@/lib/tesla/client';
import { getVehicleCache, saveVehicleCache } from '@/lib/db';
import type {
  FleetStatusResponse,
  UserMe,
  VehicleData,
  VehicleListItem,
} from '@/lib/tesla/types';

export async function listVehicles(): Promise<VehicleListItem[]> {
  const all: VehicleListItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const batch = await fleetFetch<VehicleListItem[]>(`/api/1/vehicles?page=${page}&per_page=100`);
    all.push(...batch);
    hasMore = batch.length === 100;
    page += 1;
  }

  return all;
}

export async function getVehicle(vin: string): Promise<VehicleListItem> {
  return fleetFetch<VehicleListItem>(`/api/1/vehicles/${vin}`);
}

export async function getFleetStatus(vins: string[]): Promise<FleetStatusResponse['response']> {
  if (vins.length === 0) {
    return { key_paired_vins: [], unpaired_vins: [], vehicle_info: {} };
  }
  return fleetFetch<FleetStatusResponse['response']>('/api/1/vehicles/fleet_status', {
    method: 'POST',
    body: JSON.stringify({ vins }),
  });
}

export async function getUserMe(): Promise<UserMe> {
  return fleetFetch<UserMe>('/api/1/users/me');
}

export async function fetchVehicleData(vin: string, wake = false): Promise<VehicleData> {
  if (wake) {
    try {
      await fleetFetch<VehicleListItem>(`/api/1/vehicles/${vin}/wake_up`, { method: 'POST' });
      await new Promise((r) => setTimeout(r, 5000));
    } catch {
      // wake may fail if already online
    }
  }

  const data = await fleetFetch<VehicleData>(`/api/1/vehicles/${vin}/vehicle_data`);
  saveVehicleCache(vin, data, data.state);
  return data;
}

export function getCachedVehicleData(vin: string): { data: VehicleData; fetchedAt: number } | null {
  const cached = getVehicleCache(vin);
  if (!cached) return null;
  return { data: cached.data as VehicleData, fetchedAt: cached.fetchedAt };
}

export async function wakeVehicle(vin: string): Promise<VehicleListItem> {
  return fleetFetch<VehicleListItem>(`/api/1/vehicles/${vin}/wake_up`, { method: 'POST' });
}
