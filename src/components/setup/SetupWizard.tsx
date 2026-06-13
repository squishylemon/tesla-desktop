import { useEffect, useState } from 'react';
import type { DeveloperConfig } from '@/lib/db';
import { REGION_OPTIONS, type TeslaRegion } from '@/env';
import { readApiJson } from '@/lib/api-response';

interface Props {
  initialConfig: DeveloperConfig | null;
  publicKey: string | null;
  publicKeyUrl: string | null;
  relayConfigured: boolean;
  relayApiUrl: string;
  relayInstanceId: string | null;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-tesla-muted">{label}</p>
      <div className="flex gap-2">
        <code className="tesla-input flex-1 break-all text-xs">{value}</code>
        <button type="button" className="tesla-btn-secondary shrink-0 px-3 text-xs" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function initialStep(
  relayInstanceId: string | null,
  initialConfig: DeveloperConfig | null,
): number {
  if (!relayInstanceId) return 1;
  if (!initialConfig?.clientId) return 2;
  if (!initialConfig.partnerRegistered) return 3;
  return 4;
}

export default function SetupWizard({
  initialConfig,
  publicKey,
  publicKeyUrl,
  relayConfigured,
  relayApiUrl,
  relayInstanceId,
}: Props) {
  const [step, setStep] = useState(initialStep(relayInstanceId, initialConfig));
  const [clientId, setClientId] = useState(initialConfig?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [region, setRegion] = useState<TeslaRegion>(initialConfig?.region ?? 'NA');
  const [domain, setDomain] = useState(initialConfig?.domain ?? '');
  const [redirectUri, setRedirectUri] = useState(initialConfig?.redirectUri ?? '');
  const [allowedOrigin, setAllowedOrigin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerRegistered, setPartnerRegistered] = useState(
    initialConfig?.partnerRegistered ?? false,
  );
  const [keyCheck, setKeyCheck] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const [portalConfirmed, setPortalConfirmed] = useState(false);
  const [instanceId, setInstanceId] = useState(relayInstanceId ?? '');

  useEffect(() => {
    if (step !== 3) return;
    fetch('/api/setup/partner')
      .then((r) => r.json())
      .then((data) => {
        if (data.prerequisites) {
          setKeyCheck({
            ok: data.prerequisites.ok,
            error: data.prerequisites.checks?.publicKeyError,
          });
        }
      })
      .catch(() => setKeyCheck(null));
  }, [step, domain]);

  async function connectRelay() {
    setLoading(true);
    setError(null);
    try {
      const result = await readApiJson<{
        instanceId: string;
        partnerDomain: string;
        redirectUri: string;
        allowedOrigin: string;
        publicKeyUrl: string;
      }>(await fetch('/api/relay/register', { method: 'POST' }), 'Relay connection failed');
      setInstanceId(result.instanceId);
      setDomain(result.partnerDomain);
      setRedirectUri(result.redirectUri);
      setAllowedOrigin(result.allowedOrigin);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Relay connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveCredentials() {
    setLoading(true);
    setError(null);
    try {
      await readApiJson(
        await fetch('/api/setup/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret, region }),
        }),
        'Failed to save credentials',
      );
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  }

  async function registerPartner() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await res.json()) as { error?: string; hints?: string[] };
      if (!res.ok) {
        const parts = [data.error, ...(data.hints ?? [])].filter(Boolean);
        throw new Error(parts.join('\n') || 'Partner registration failed');
      }
      setPartnerRegistered(true);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Partner registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (!relayConfigured) {
    return (
      <div className="mx-auto max-w-lg">
        <img src="/imgs/logo_white.png" alt="Tesla" className="mb-8 h-6" />
        <h1 className="mb-2 text-3xl font-semibold">Relay required</h1>
        <p className="mb-4 text-tesla-muted">
          Set <code className="text-white">RELAY_API_URL</code> in your <code>.env</code> file, then
          restart the container.
        </p>
        <div className="tesla-card text-sm">
          <code>RELAY_API_URL=https://auth.tesla-desktop.example.com</code>
        </div>
        {relayApiUrl && (
          <p className="mt-4 text-xs text-tesla-muted">Current value: {relayApiUrl}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <img src="/imgs/logo_white.png" alt="Tesla" className="mb-8 h-6" />
      <h1 className="mb-2 text-3xl font-semibold">Welcome to Tesla Desktop</h1>
      <p className="mb-8 text-tesla-muted">
        Self-hosted vehicle dashboard. You use the app at localhost; Tesla API traffic goes through
        the relay.
      </p>

      <div className="mb-8 flex gap-2">
        {[0, 1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/20'}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6 whitespace-pre-wrap rounded-lg border border-tesla-red/50 bg-tesla-red/10 px-4 py-3 text-sm text-tesla-red">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6">
          <div className="tesla-card space-y-4">
            <h2 className="text-lg font-medium">Before you begin</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-tesla-muted">
              <li>
                Create an application at{' '}
                <a
                  href="https://developer.tesla.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline"
                >
                  developer.tesla.com
                </a>
              </li>
              <li>
                Request scopes: vehicle_device_data, vehicle_location, vehicle_cmds,
                vehicle_charging_cmds, offline_access, openid, user_data
              </li>
              <li>Add a payment method and billing limit on your developer dashboard</li>
              <li>Connect to the relay to get your instance URLs for the Tesla portal</li>
              <li>Accept the self-signed certificate warning when visiting localhost:4321</li>
            </ol>
          </div>
          <button type="button" className="tesla-btn-primary w-full" onClick={() => setStep(1)}>
            Get Started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Connect to relay</h2>
          <p className="text-sm text-tesla-muted">
            Creates your unique subdomain on <code className="text-white">{relayApiUrl}</code> and
            uploads your public key. DNS may take a few minutes to propagate.
          </p>
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={loading}
            onClick={connectRelay}
          >
            {loading ? 'Connecting…' : instanceId ? 'Reconnect' : 'Connect'}
          </button>
        </div>
      )}

      {step === 2 && instanceId && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Tesla developer portal</h2>
          <p className="text-sm text-tesla-muted">
            Add these values to your application on{' '}
            <a
              href="https://developer.tesla.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              developer.tesla.com
            </a>
            , then enter your credentials below.
          </p>

          <div className="tesla-card space-y-3">
            <CopyField label="Allowed Origin" value={allowedOrigin} />
            <CopyField label="Redirect URL" value={redirectUri} />
            <CopyField label="Partner domain" value={domain} />
            {publicKeyUrl && (
              <p className="text-xs text-tesla-muted">
                Public key:{' '}
                <a href={publicKeyUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {publicKeyUrl}
                </a>
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={portalConfirmed}
              onChange={(e) => setPortalConfirmed(e.target.checked)}
            />
            <span>
              I added the <strong>Allowed Origin</strong> and <strong>Redirect URL</strong> on
              developer.tesla.com
            </span>
          </label>

          <input
            className="tesla-input"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <input
            className="tesla-input"
            type="password"
            placeholder="Client Secret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <select
            className="tesla-input"
            value={region}
            onChange={(e) => setRegion(e.target.value as TeslaRegion)}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={!portalConfirmed || !clientId || !clientSecret || loading}
            onClick={saveCredentials}
          >
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Register with Tesla</h2>
          <div className="tesla-card space-y-3">
            <CopyField label="Partner domain" value={domain} />
            <p>
              <span className="text-sm text-tesla-muted">Public key reachable:</span>{' '}
              {keyCheck?.ok ? (
                <span className="text-sm text-tesla-green">Yes</span>
              ) : keyCheck ? (
                <span className="text-sm text-tesla-red">{keyCheck.error ?? 'No'}</span>
              ) : (
                <span className="text-sm text-tesla-muted">Checking…</span>
              )}
            </p>
          </div>

          {publicKey && (
            <details className="text-sm">
              <summary className="cursor-pointer text-tesla-muted">View public key</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white/5 p-3 text-xs">{publicKey}</pre>
            </details>
          )}

          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={loading || !keyCheck?.ok}
            onClick={registerPartner}
          >
            {loading ? 'Registering…' : partnerRegistered ? 'Re-register' : 'Register Domain'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-medium">Setup complete</h2>
          <p className="text-sm text-tesla-muted">
            Sign in, then pair your virtual key from the garage page.
          </p>
          <a href="/auth/login" className="tesla-btn-primary inline-flex w-full justify-center">
            Sign In with Tesla
          </a>
        </div>
      )}
    </div>
  );
}
