import { useState } from 'react';
import { getVirtualKeyPairingSteps, getVirtualKeyPairingUrl } from '@/lib/tesla/virtual-key';

interface Props {
  partnerDomain: string;
  partnerRegistered?: boolean;
  vin?: string;
  compact?: boolean;
}

export default function VirtualKeyPairing({
  partnerDomain,
  partnerRegistered = false,
  vin,
  compact = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const pairingUrl = getVirtualKeyPairingUrl(partnerDomain, vin);

  async function copyLink() {
    if (!pairingUrl) return;
    await navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!partnerRegistered) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <strong>Partner registration required</strong> before virtual key pairing. Go to{' '}
        <a href="/setup" className="text-white underline">
          Setup
        </a>{' '}
        and click Register Domain.
      </div>
    );
  }

  if (!pairingUrl) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <strong>Hostname required.</strong> Set a partner hostname in Setup (not localhost) — Tesla
        uses <code className="text-white">tesla.com/_ak/your-hostname</code> for pairing.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <strong>Virtual key not paired.</strong>{' '}
        <a href={pairingUrl} className="text-white underline">
          Pair in Tesla app
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm">
      <h3 className="mb-2 font-medium">Pair virtual key</h3>
      <p className="mb-4 text-tesla-muted">
        Remote commands require a virtual key on your vehicle. Use Tesla&apos;s official pairing
        link for domain <strong className="text-white">{partnerDomain}</strong>.
      </p>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-tesla-muted">
        {getVirtualKeyPairingSteps(partnerDomain).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={pairingUrl} className="tesla-btn-primary flex-1 text-center">
          Open Tesla app to pair{vin ? ' this vehicle' : ''}
        </a>
        <button type="button" className="tesla-btn-secondary flex-1" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy pairing link'}
        </button>
      </div>
      <code className="mt-3 block break-all text-xs text-tesla-muted">{pairingUrl}</code>
    </div>
  );
}
