/** Tesla virtual key pairing deep links (Fleet API developer guide). */

const PAIRING_BASE = 'https://www.tesla.com/_ak';

export function getVirtualKeyPairingUrl(partnerDomain: string, vin?: string): string | null {
  const domain = partnerDomain.trim().toLowerCase();
  if (!domain || domain === 'localhost' || domain === '127.0.0.1') {
    return null;
  }

  const base = `${PAIRING_BASE}/${domain}`;
  if (vin) {
    return `${base}?vin=${encodeURIComponent(vin)}`;
  }
  return base;
}

export function getVirtualKeyPairingSteps(partnerDomain: string): string[] {
  return [
    'Complete partner registration in Setup (Register Domain)',
    `Confirm public key is live: https://${partnerDomain}/.well-known/appspecific/com.tesla.3p.public-key.pem`,
    'On your phone, open the pairing link below (Tesla app must be installed)',
    'Follow prompts in the Tesla app to add the virtual key to your vehicle',
    'Return here and refresh — fleet_status should show your VIN as paired',
  ];
}
