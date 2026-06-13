import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapMarker } from '@/lib/tesla/vehicle-images';
import type { VehicleConfig } from '@/lib/tesla/types';

interface Props {
  vin: string;
  name: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  heading?: number | null;
  online: boolean;
  config?: VehicleConfig;
  fetchedAt?: number;
}

export default function VehicleMap({ vin, name }: Props) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tesla/vehicles/${vin}/location`);
        if (!res.ok) throw new Error((await res.json()).error ?? 'No location data');
        setLocation(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load location');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vin]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-24">
        <img src="/imgs/spinner.png" alt="" className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="py-12 text-center">
        <p className="text-tesla-muted">{error ?? 'Location unavailable'}</p>
        <p className="mt-2 text-sm text-tesla-muted">
          Tap Refresh on the vehicle overview to fetch live location data.
        </p>
      </div>
    );
  }

  const icon = L.icon({
    iconUrl: getMapMarker(location.online, location.config),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-tesla-muted">Location</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <a href={`/vehicles/${vin}`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Overview
        </a>
        <a href={`/vehicles/${vin}/controls`} className="tesla-btn-secondary px-4 py-2 text-xs">
          Controls
        </a>
        <a href={`/vehicles/${vin}/location`} className="tesla-btn-secondary px-4 py-2 text-xs bg-white/10">
          Location
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10" style={{ height: 480 }}>
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={15}
          style={{ height: '100%', width: '100%', background: '#111' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[location.latitude, location.longitude]} icon={icon} />
        </MapContainer>
      </div>

      <p className="mt-4 text-sm text-tesla-muted">
        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        {location.fetchedAt && (
          <> · Updated {new Date(location.fetchedAt).toLocaleString()}</>
        )}
      </p>
    </div>
  );
}
