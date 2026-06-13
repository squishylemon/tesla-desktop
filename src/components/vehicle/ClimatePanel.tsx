import type { ClimateState } from '@/lib/tesla/types';

interface Props {
  climate?: ClimateState;
  onToggle?: (on: boolean) => void;
  loading?: boolean;
}

export default function ClimatePanel({ climate, onToggle, loading }: Props) {
  const isOn = climate?.is_climate_on ?? false;

  return (
    <div className="tesla-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">Climate</h3>
        {onToggle && (
          <button
            type="button"
            className="tesla-btn-secondary px-4 py-2 text-xs"
            disabled={loading}
            onClick={() => onToggle(!isOn)}
          >
            {loading ? '…' : isOn ? 'Turn Off' : 'Turn On'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-tesla-muted">Inside</p>
          <p className="text-xl font-medium">
            {climate?.inside_temp != null ? `${climate.inside_temp.toFixed(1)}°` : '—'}
          </p>
        </div>
        <div>
          <p className="text-tesla-muted">Outside</p>
          <p className="text-xl font-medium">
            {climate?.outside_temp != null ? `${climate.outside_temp.toFixed(1)}°` : '—'}
          </p>
        </div>
        <div>
          <p className="text-tesla-muted">Driver set</p>
          <p>{climate?.driver_temp_setting != null ? `${climate.driver_temp_setting}°` : '—'}</p>
        </div>
        <div>
          <p className="text-tesla-muted">Status</p>
          <p className={isOn ? 'text-tesla-green' : 'text-tesla-muted'}>
            {isOn ? 'On' : 'Off'}
          </p>
        </div>
      </div>
    </div>
  );
}
