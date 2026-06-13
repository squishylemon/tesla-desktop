import type { ChargeState } from '@/lib/tesla/types';

interface Props {
  charge?: ChargeState;
  onStart?: () => void;
  onStop?: () => void;
  loading?: boolean;
}

export default function ChargingPanel({ charge, onStart, onStop, loading }: Props) {
  const isCharging = charge?.charging_state === 'Charging';
  const isPlugged = charge?.charging_state === 'Charging' || charge?.charging_state === 'Complete' || charge?.charge_port_door_open;

  return (
    <div className="tesla-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">Charging</h3>
        <span className={isCharging ? 'tesla-badge-live' : 'tesla-badge-cached'}>
          {charge?.charging_state ?? 'Unknown'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-tesla-muted">Limit</p>
          <p className="text-xl font-medium">{charge?.charge_limit_soc ?? '—'}%</p>
        </div>
        <div>
          <p className="text-tesla-muted">Range</p>
          <p className="text-xl font-medium">
            {charge?.battery_range != null ? `${Math.round(charge.battery_range)} mi` : '—'}
          </p>
        </div>
        {charge?.time_to_full_charge != null && isCharging && (
          <div className="col-span-2">
            <p className="text-tesla-muted">Time to full</p>
            <p>{charge.time_to_full_charge.toFixed(1)} hours</p>
          </div>
        )}
      </div>
      {(onStart || onStop) && isPlugged && (
        <div className="mt-4 flex gap-2">
          {onStart && !isCharging && (
            <button type="button" className="tesla-btn-secondary flex-1 text-xs" disabled={loading} onClick={onStart}>
              Start Charging
            </button>
          )}
          {onStop && isCharging && (
            <button type="button" className="tesla-btn-secondary flex-1 text-xs" disabled={loading} onClick={onStop}>
              Stop Charging
            </button>
          )}
        </div>
      )}
    </div>
  );
}
