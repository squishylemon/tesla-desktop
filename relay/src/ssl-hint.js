/** Labels in a hostname, e.g. auth.tesla.example.com → 4 */
export function hostnameLabelCount(host) {
  return host.split('.').filter(Boolean).length;
}

/**
 * Cloudflare Universal SSL covers example.com and *.example.com only.
 * It does NOT cover a.b.example.com unless that zone is added separately.
 */
export function checkCloudflareSslDepth(oauthHost, baseDomain) {
  const oauthLabels = hostnameLabelCount(oauthHost);
  const baseLabels = hostnameLabelCount(baseDomain);
  const instanceExample = `abc123.${baseDomain}`;
  const instanceLabels = hostnameLabelCount(instanceExample);

  const warnings = [];

  if (oauthLabels > baseLabels + 1) {
    warnings.push(
      `RELAY_OAUTH_HOST (${oauthHost}) is nested under RELAY_BASE_DOMAIN (${baseDomain}). ` +
        'Cloudflare Universal SSL on the parent zone does not cover this hostname — browsers show ERR_SSL_VERSION_OR_CIPHER_MISMATCH.',
    );
  }

  if (instanceLabels > baseLabels + 1) {
    warnings.push(
      `Instance hostnames like ${instanceExample} need a wildcard on ${baseDomain}. ` +
        'Add tdesktop.example.com as its own Cloudflare zone, or use a flat base domain on your apex zone.',
    );
  }

  return warnings;
}

export function printCloudflareSslHints(oauthHost, baseDomain) {
  const warnings = checkCloudflareSslDepth(oauthHost, baseDomain);
  if (warnings.length === 0) return;

  console.warn('');
  console.warn('=== Cloudflare SSL warning ===');
  for (const w of warnings) console.warn(w);
  console.warn('');
  console.warn('Fix (pick one):');
  console.warn('  1. Add RELAY_BASE_DOMAIN as its own Cloudflare zone (recommended), use that zone CLOUDFLARE_ZONE_ID');
  console.warn('  2. Use single-level names on your apex zone, e.g. auth-foo.example.com + RELAY_BASE_DOMAIN=example.com');
  console.warn('  3. Disable Cloudflare proxy (grey cloud) and use trusted origin certs on port 8443');
  console.warn('==============================');
  console.warn('');
}
