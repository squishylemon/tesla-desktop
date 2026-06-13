import { useEffect, useState } from 'react';
import type { DeveloperConfig } from '@/lib/db';
import { REGION_OPTIONS, type TeslaRegion } from '@/env';
import { readApiJson } from '@/lib/api-response';

interface Props {
  initialConfig: DeveloperConfig | null;
  publicKey: string | null;
  publicKeyUrl: string | null;
  appOrigin: string;
  relayMode?: boolean;
  relayInstanceId?: string | null;
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

export default function SetupWizard({
  initialConfig,
  publicKey,
  publicKeyUrl,
  appOrigin,
  relayMode = false,
  relayInstanceId = null,
}: Props) {
  const [step, setStep] = useState(
    relayMode ? (initialConfig && relayInstanceId ? 2 : 1) : initialConfig ? 2 : 0,
  );
  const [clientId, setClientId] = useState(initialConfig?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [region, setRegion] = useState<TeslaRegion>(initialConfig?.region ?? 'NA');
  const [domain, setDomain] = useState(initialConfig?.domain ?? 'localhost');
  const [redirectUri, setRedirectUri] = useState(
    initialConfig?.redirectUri ?? `${appOrigin}/auth/callback`,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerRegistered, setPartnerRegistered] = useState(
    initialConfig?.partnerRegistered ?? false,
  );
  const [keyCheck, setKeyCheck] = useState<{
    ok: boolean;
    publicKeyUrl?: string;
    error?: string;
    needsPublicHost?: boolean;
  } | null>(null);
  const [portalConfirmed, setPortalConfirmed] = useState(relayMode);
  const [instanceId, setInstanceId] = useState(relayInstanceId ?? '');

  const allowedOrigin = redirectUri.replace(/\/auth\/callback$/, '');
  const isLocalDomain = domain === 'localhost' || domain.startsWith('127.0.0.1');

  useEffect(() => {
    if (step !== 2) return;
    fetch('/api/setup/partner')
      .then((r) => r.json())
      .then((data) => {
        if (data.prerequisites) {
          setKeyCheck({
            ok: data.prerequisites.ok,
            needsPublicHost: data.prerequisites.needsPublicHost,
            publicKeyUrl: data.prerequisites.checks?.publicKeyUrl,
            error: data.prerequisites.checks?.publicKeyError,
          });
        }
      })
      .catch(() => setKeyCheck(null));
  }, [step, domain, redirectUri]);

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
      const result = await readApiJson<{ redirectUri: string; domain: string }>(
        await fetch('/api/setup/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret, region, domain }),
        }),
        'Failed to save credentials',
      );
      setRedirectUri(result.redirectUri);
      setDomain(result.domain);
      setStep(2);
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
      const data = (await res.json()) as {
        error?: string;
        hints?: string[];
      };
      if (!res.ok) {
        const parts = [data.error, ...(data.hints ?? [])].filter(Boolean);
        throw new Error(parts.join('\n') || 'Partner registration failed');
      }
      setPartnerRegistered(true);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Partner registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <img src="/imgs/logo_white.png" alt="Tesla" className="mb-8 h-6" />
      <h1 className="mb-2 text-3xl font-semibold">Welcome to Tesla Desktop</h1>
      <p className="mb-8 text-tesla-muted">
        Self-hosted vehicle dashboard powered by the official Tesla Fleet API.
      </p>

      <div className="mb-8 flex gap-2">
        {[0, 1, 2, 3].map((s) => (
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
            {relayMode ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-tesla-muted">
                <li>
                  This install uses the <strong className="text-white">shared relay</strong> for Tesla
                  OAuth and partner registration
                </li>
                <li>You browse the app at <strong className="text-white">localhost:4321</strong></li>
                <li>Sign-in and virtual-key pairing use your unique relay subdomain</li>
                <li>
                  Accept the self-signed certificate warning on first visit to localhost
                </li>
              </ol>
            ) : (
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
                <li>
                  The app uses a <strong className="text-white">self-signed HTTPS certificate</strong>{' '}
                  — accept the browser warning on first visit
                </li>
              </ol>
            )}
          </div>
          <button type="button" className="tesla-btn-primary w-full" onClick={() => setStep(1)}>
            Get Started
          </button>
        </div>
      )}

      {step === 1 && relayMode && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Connect to Relay</h2>
          <p className="text-sm text-tesla-muted">
            Creates your unique partner subdomain on the relay and uploads your public key. DNS may
            take a few minutes to propagate.
          </p>
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={loading}
            onClick={connectRelay}
          >
            {loading ? 'Connecting…' : instanceId ? 'Reconnect Relay' : 'Connect to Relay'}
          </button>
        </div>
      )}

      {step === 1 && !relayMode && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Developer Credentials</h2>

          <div className="tesla-card space-y-3 text-sm">
            <p className="text-tesla-muted">
              App URL (self-signed HTTPS). Add these on developer.tesla.com:
            </p>
            <CopyField label="Allowed Origin" value={allowedOrigin} />
            <CopyField label="Redirect URL" value={redirectUri} />
          </div>

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
          <input
            className="tesla-input"
            placeholder="Partner hostname (e.g. tesla.home.example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <p className="text-xs text-tesla-muted">
            Hostname only — used for partner registration and virtual key pairing. Use your own domain
            with port 4321 forwarded (not localhost) so Tesla can verify your public key.
          </p>
          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={!clientId || !clientSecret || loading}
            onClick={saveCredentials}
          >
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      )}

      {step === 2 && relayMode && instanceId && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Register with Tesla</h2>
          <div className="tesla-card space-y-3">
            <CopyField label="Instance ID" value={instanceId} />
            <CopyField label="Partner domain" value={domain} />
            <CopyField label="OAuth redirect (relay)" value={redirectUri} />
            {publicKeyUrl && (
              <p className="text-xs text-tesla-muted">
                Public key:{' '}
                <a href={publicKeyUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {publicKeyUrl}
                </a>
              </p>
            )}
            <p>
              <span className="text-sm text-tesla-muted">Key reachable:</span>{' '}
              {keyCheck?.ok ? (
                <span className="text-sm text-tesla-green">Yes</span>
              ) : keyCheck ? (
                <span className="text-sm text-tesla-red">{keyCheck.error ?? 'No'}</span>
              ) : (
                <span className="text-sm text-tesla-muted">Checking…</span>
              )}
            </p>
          </div>
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

      {step === 2 && !relayMode && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Register with Tesla</h2>

          {isLocalDomain && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
              <strong>localhost cannot be registered.</strong> Set a real hostname in .env (
              TESLA_DOMAIN) and port-forward 4321, then re-save credentials.
            </div>
          )}

          <div className="tesla-card space-y-3">
            <CopyField label="Partner domain" value={domain} />
            <CopyField label="Allowed Origin" value={allowedOrigin} />
            <CopyField label="Redirect URL" value={redirectUri} />
            {publicKeyUrl && (
              <p className="text-xs text-tesla-muted">
                Public key:{' '}
                <a href={publicKeyUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {publicKeyUrl}
                </a>
              </p>
            )}
            <p>
              <span className="text-sm text-tesla-muted">Key reachable locally:</span>{' '}
              {keyCheck?.ok ? (
                <span className="text-sm text-tesla-green">Yes</span>
              ) : keyCheck ? (
                <span className="text-sm text-tesla-red">{keyCheck.error ?? 'No'}</span>
              ) : (
                <span className="text-sm text-tesla-muted">Checking…</span>
              )}
            </p>
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

          {publicKey && (
            <details className="text-sm">
              <summary className="cursor-pointer text-tesla-muted">View public key</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white/5 p-3 text-xs">{publicKey}</pre>
            </details>
          )}

          <button
            type="button"
            className="tesla-btn-primary w-full"
            disabled={loading || !portalConfirmed || isLocalDomain}
            onClick={registerPartner}
          >
            {loading ? 'Registering…' : partnerRegistered ? 'Re-register' : 'Register Domain'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-medium">Setup Complete</h2>
          <p className="text-sm text-tesla-muted">
            Sign in, then pair your virtual key using the link on the garage page.
          </p>
          <a href="/auth/login" className="tesla-btn-primary inline-flex w-full justify-center">
            Sign In with Tesla
          </a>
        </div>
      )}
    </div>
  );
}
