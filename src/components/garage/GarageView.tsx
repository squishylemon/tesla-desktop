import { useCallback, useEffect, useState } from 'react';
import VehicleCard from '@/components/garage/VehicleCard';
import VirtualKeyPairing from '@/components/vehicle/VirtualKeyPairing';
import { isPartnerRegistrationError } from '@/lib/tesla/errors';
import type { FleetStatusItem, VehicleData, VehicleListItem } from '@/lib/tesla/types';

interface GarageData {
  vehicles: VehicleListItem[];
  fleetStatus: {
    key_paired_vins: string[];
    unpaired_vins: string[];
    vehicle_info: Record<string, FleetStatusItem>;
  };
  caches: Record<string, { data: VehicleData; fetchedAt: number }>;
  user?: { email?: string; fullName?: string };
  partnerDomain?: string | null;
  partnerRegistered?: boolean;
}

export default function GarageView() {
  const [data, setData] = useState<GarageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tesla/garage');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to load garage');
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <img src="/imgs/spinner.png" alt="" className="h-8 w-8 animate-spin" />
        <p className="mt-4 text-tesla-muted">Loading vehicles…</p>
      </div>
    );
  }

  if (error) {
    const needsPartner = isPartnerRegistrationError(error);

    return (
      <div className="mx-auto max-w-lg py-16">
        {needsPartner ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-tesla-red/40 bg-tesla-red/10 px-5 py-4">
              <h2 className="mb-2 text-lg font-medium">Partner registration required</h2>
              <p className="text-sm text-tesla-muted">
                Sign-in worked, but Tesla will not return vehicle data until your domain is
                registered. Open setup, add the shown URLs to developer.tesla.com, then register.
              </p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-tesla-muted">
              <li>
                Go to <a href="/setup" className="text-white underline">Setup</a>
              </li>
              <li>Set your hostname (not localhost) and port-forward 4321</li>
              <li>Copy HTTPS URLs into developer.tesla.com, then Register Domain</li>
            </ol>
            <details className="text-xs text-tesla-muted">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/5 p-3">{error}</pre>
            </details>
            <div className="flex gap-3">
              <a href="/setup" className="tesla-btn-primary flex-1 text-center">
                Open Setup
              </a>
              <button type="button" className="tesla-btn-secondary flex-1" onClick={load}>
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-tesla-red">{error}</p>
            <button type="button" className="tesla-btn-secondary mt-4" onClick={load}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!data?.vehicles.length) {
    return (
      <div className="py-24 text-center">
        <p className="text-tesla-muted">No vehicles found on this account.</p>
      </div>
    );
  }

  const hasUnpaired = data.fleetStatus.unpaired_vins.length > 0;

  return (
    <div>
      {data.user?.fullName && (
        <p className="mb-6 text-tesla-muted">Welcome back, {data.user.fullName}</p>
      )}

      {hasUnpaired && data.partnerDomain && (
        <div className="mb-6">
          <VirtualKeyPairing
            partnerDomain={data.partnerDomain}
            partnerRegistered={data.partnerRegistered}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data.vehicles.map((v) => (
          <VehicleCard
            key={v.vin ?? v.id_s}
            vehicle={v}
            fleetInfo={data.fleetStatus.vehicle_info[v.vin]}
            cache={data.caches[v.vin]}
            unpaired={data.fleetStatus.unpaired_vins.includes(v.vin)}
          />
        ))}
      </div>
    </div>
  );
}
