/** @param {string | undefined} raw */
export function parseAllowedIps(raw) {
  const value = (raw ?? '*').trim();
  if (!value || value === '*' || value.toLowerCase() === 'all') {
    return { allowAll: true, entries: [] };
  }
  return {
    allowAll: false,
    entries: value.split(',').map((e) => e.trim()).filter(Boolean),
  };
}

function normalizeIp(ip) {
  return ip.replace(/^::ffff:/, '').trim().toLowerCase();
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function matchCidr(ip, cidr) {
  const [network, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!network || Number.isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

/** @param {string} clientIp @param {ReturnType<typeof parseAllowedIps>} allowed */
export function isIpAllowed(clientIp, allowed) {
  if (allowed.allowAll) return true;

  const ip = normalizeIp(clientIp);
  if (!ip) return false;

  for (const entry of allowed.entries) {
    const rule = entry.toLowerCase();
    if (rule === ip) return true;
    if (rule.includes('/') && matchCidr(ip, rule)) return true;
  }

  return false;
}

/** @param {import('node:http').IncomingMessage} req */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return normalizeIp(forwarded.split(',')[0]);
  }
  return normalizeIp(req.socket.remoteAddress ?? '');
}
