import { useEffect, useState } from 'react';
import type { DeveloperConfig } from '@/lib/db';

interface SettingsData {
  config: DeveloperConfig | null;
  user?: { email?: string; fullName?: string };
  publicKeyUrl?: string;
}

export default function SettingsView() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  function loadSettings() {
    return fetch('/api/settings')
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    loadSettings().finally(() => setLoading(false));
  }, []);

  async function registerPartner() {
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await fetch('/api/setup/partner', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        const parts = [body.error, ...(body.hints ?? [])].filter(Boolean);
        throw new Error(parts.join('\n') || 'Registration failed');
      }
      await loadSettings();
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setRegistering(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth/login';
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <img src="/imgs/mini_spinner.png" alt="" className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {data?.user && (
        <div className="tesla-card">
          <h2 className="mb-3 font-medium">Account</h2>
          <p>{data.user.fullName}</p>
          <p className="text-sm text-tesla-muted">{data.user.email}</p>
        </div>
      )}

      {data?.config && (
        <div className="tesla-card space-y-2 text-sm">
          <h2 className="mb-3 font-medium">API Configuration</h2>
          <p>
            <span className="text-tesla-muted">Region:</span> {data.config.region}
          </p>
          <p>
            <span className="text-tesla-muted">Domain:</span> {data.config.domain}
          </p>
          <p>
            <span className="text-tesla-muted">Partner registered:</span>{' '}
            {data.config.partnerRegistered ? (
              <span className="text-tesla-green">Yes</span>
            ) : (
              <span className="text-tesla-red">No — garage will not load</span>
            )}
          </p>
          {data.publicKeyUrl && (
            <p className="break-all">
              <span className="text-tesla-muted">Public key:</span> {data.publicKeyUrl}
            </p>
          )}
        </div>
      )}

      {registerError && (
        <div className="whitespace-pre-wrap rounded-lg border border-tesla-red/50 bg-tesla-red/10 px-4 py-3 text-sm text-tesla-red">
          {registerError}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!data?.config?.partnerRegistered && (
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={registering}
            onClick={registerPartner}
          >
            {registering ? 'Registering…' : 'Register with Tesla'}
          </button>
        )}
        <a href="/setup" className="tesla-btn-secondary text-center">
          Re-run Setup
        </a>
        <a href="/auth/login" className="tesla-btn-secondary text-center">
          Re-authenticate
        </a>
        <button type="button" className="tesla-btn-danger w-full" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
