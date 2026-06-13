import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig, instanceHostname, parseInstanceFromHost } from './config.js';
import { createStore } from './store.js';
import { createCloudflareClient } from './cloudflare.js';
import { startCleanupJob } from './cleanup.js';
import { getClientIp, isIpAllowed } from './allowed-ips.js';

const PUBLIC_KEY_PATH = '/.well-known/appspecific/com.tesla.3p.public-key.pem';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function parseBearer(req) {
  const h = req.headers.authorization ?? '';
  const m = /^Bearer (.+)$/.exec(h);
  return m?.[1] ?? null;
}

function requireInstanceAuth(store, req, instanceId) {
  const row = store.getInstance(instanceId);
  if (!row) return { error: 'instance_not_found', status: 404 };
  const token = parseBearer(req);
  if (!token || !safeEqual(token, row.secret)) {
    return { error: 'unauthorized', status: 401 };
  }
  return { row };
}

function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeState(state) {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function exchangeTeslaCode(config, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.tesla.clientId,
    client_secret: config.tesla.clientSecret,
    code,
    redirect_uri: config.oauthRedirectUri,
    audience: config.tesla.audience,
  });

  const res = await fetch(`${config.tesla.authUrl}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tesla token exchange failed (${res.status}): ${text}`);
  }

  const data = JSON.parse(text);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

function buildAuthorizeUrl(config, state) {
  const params = new URLSearchParams({
    client_id: config.tesla.clientId,
    redirect_uri: config.oauthRedirectUri,
    response_type: 'code',
    scope: config.tesla.scopes,
    state,
    audience: config.tesla.audience,
  });
  return `${config.tesla.authUrl}/oauth2/v3/authorize?${params}`;
}

function instanceUrls(config, instanceId) {
  const host = instanceHostname(instanceId, config.baseDomain);
  const origin = `https://${host}`;
  return {
    instanceId,
    partnerDomain: host,
    allowedOrigin: config.oauthOrigin,
    redirectUri: config.oauthRedirectUri,
    publicKeyUrl: `${origin}${PUBLIC_KEY_PATH}`,
  };
}

const FLEET_BASE_URLS = {
  NA: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  EU: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
  CN: 'https://fleet-api.prd.cn.vn.cloud.tesla.cn',
};

async function getPartnerToken(config, region) {
  const audience = FLEET_BASE_URLS[region] ?? FLEET_BASE_URLS.NA;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.tesla.clientId,
    client_secret: config.tesla.clientSecret,
    scope: 'openid user_data vehicle_device_data vehicle_location vehicle_cmds vehicle_charging_cmds',
    audience,
  });
  const res = await fetch(`${config.tesla.authUrl}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Partner token failed (${res.status})`);
  return data.access_token;
}

async function registerPartnerDomain(config, region, partnerDomain) {
  const baseUrl = FLEET_BASE_URLS[region] ?? FLEET_BASE_URLS.NA;
  const token = await getPartnerToken(config, region);
  const res = await fetch(`${baseUrl}/api/1/partner_accounts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ domain: partnerDomain }),
  });
  if (res.ok || res.status === 409) return;
  const text = await res.text();
  throw new Error(`[${region}] Partner registration failed (${res.status}): ${text}`);
}

async function handleRegister(config, store, cloudflare, req, res) {
  const clientIp = getClientIp(req);
  if (!isIpAllowed(clientIp, config.allowedIps)) {
    return json(res, 403, {
      error: 'ip_not_allowed',
      message: `Registration not allowed from ${clientIp || 'unknown IP'}`,
    });
  }

  const body = await readBody(req);
  if (config.bootstrapSecret && body.bootstrapSecret !== config.bootstrapSecret) {
    return json(res, 403, { error: 'invalid_bootstrap_secret' });
  }

  const row = store.createInstance({});

  if (cloudflare.enabled) {
    try {
      const dns = await cloudflare.createInstanceRecord(row.id, config.baseDomain);
      store.setCloudflareRecordId(row.id, dns.id);
    } catch (e) {
      store.deleteInstance(row.id);
      return json(res, 502, {
        error: 'dns_create_failed',
        message: e instanceof Error ? e.message : 'DNS create failed',
      });
    }
  }

  return json(res, 201, {
    ...instanceUrls(config, row.id),
    instanceSecret: row.secret,
    relayOAuthAuthorizeUrl: `${config.oauthOrigin}/oauth/authorize?instance=${row.id}`,
  });
}

async function main() {
  const config = getConfig();
  const store = createStore(config.storePath);
  const cloudflare = createCloudflareClient(config);

  startCleanupJob({ store, cloudflare, config });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const host = req.headers.host ?? '';
      const path = url.pathname;

      // --- Public key (per-instance subdomain) ---
      if (path === PUBLIC_KEY_PATH && req.method === 'GET') {
        const instanceId = parseInstanceFromHost(host, config.baseDomain);
        if (!instanceId) {
          return json(res, 404, { error: 'unknown_host' });
        }
        const row = store.getInstance(instanceId);
        if (!row?.publicKeyPem) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Public key not uploaded');
        }
        store.touchInstance(instanceId);
        res.writeHead(200, { 'Content-Type': 'application/x-pem-file' });
        return res.end(row.publicKeyPem);
      }

      // --- OAuth start (fixed auth host) ---
      if (path === '/oauth/authorize' && req.method === 'GET') {
        const instanceId = url.searchParams.get('instance');
        const returnUrl = url.searchParams.get('return_url') ?? 'https://localhost:4321/auth/relay-complete';
        if (!instanceId || !store.getInstance(instanceId)) {
          return json(res, 400, { error: 'invalid_instance' });
        }

        store.touchInstance(instanceId);
        const nonce = randomBytes(16).toString('hex');
        const state = encodeState({ instanceId, returnUrl, nonce });
        res.writeHead(302, { Location: buildAuthorizeUrl(config, state) });
        return res.end();
      }

      // --- OAuth callback (fixed auth host; single redirect URI in Tesla portal) ---
      if (path === '/auth/callback' && req.method === 'GET') {
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const stateRaw = url.searchParams.get('state');
        const parsed = stateRaw ? decodeState(stateRaw) : null;

        const fallback = parsed?.returnUrl ?? 'https://localhost:4321/auth/relay-complete';

        if (error) {
          const loc = new URL(fallback);
          loc.searchParams.set('error', error);
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        }

        if (!code || !parsed?.instanceId || !store.getInstance(parsed.instanceId)) {
          const loc = new URL(fallback);
          loc.searchParams.set('error', 'invalid_oauth_state');
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        }

        try {
          const tokens = await exchangeTeslaCode(config, code);
          const relayToken = randomBytes(24).toString('hex');
          store.savePendingOAuth(relayToken, {
            instanceId: parsed.instanceId,
            ...tokens,
          });
          store.touchInstance(parsed.instanceId);

          const loc = new URL(fallback);
          loc.searchParams.set('relay_token', relayToken);
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        } catch (e) {
          const loc = new URL(fallback);
          loc.searchParams.set('error', e instanceof Error ? e.message : 'token_exchange_failed');
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        }
      }

      // --- API ---
      if (path === '/api/v1/instances' && req.method === 'POST') {
        return handleRegister(config, store, cloudflare, req, res);
      }

      const heartbeatMatch = /^\/api\/v1\/instances\/([a-f0-9]+)\/heartbeat$/.exec(path);
      if (heartbeatMatch && req.method === 'POST') {
        const auth = requireInstanceAuth(store, req, heartbeatMatch[1]);
        if (auth.error) return json(res, auth.status, { error: auth.error });
        store.touchInstance(auth.row.id);
        return json(res, 200, { ok: true, lastSeenAt: auth.row.lastSeenAt });
      }

      const publicKeyMatch = /^\/api\/v1\/instances\/([a-f0-9]+)\/public-key$/.exec(path);
      if (publicKeyMatch && req.method === 'PUT') {
        const auth = requireInstanceAuth(store, req, publicKeyMatch[1]);
        if (auth.error) return json(res, auth.status, { error: auth.error });
        const body = await readBody(req);
        if (!body.publicKeyPem?.includes('BEGIN PUBLIC KEY')) {
          return json(res, 400, { error: 'invalid_public_key' });
        }
        store.setPublicKey(auth.row.id, body.publicKeyPem.trim());
        return json(res, 200, { ok: true, ...instanceUrls(config, auth.row.id) });
      }

      const oauthExchangeMatch = /^\/api\/v1\/instances\/([a-f0-9]+)\/oauth\/exchange$/.exec(path);
      if (oauthExchangeMatch && req.method === 'POST') {
        const auth = requireInstanceAuth(store, req, oauthExchangeMatch[1]);
        if (auth.error) return json(res, auth.status, { error: auth.error });
        const body = await readBody(req);
        const pending = body.relayToken ? store.consumePendingOAuth(body.relayToken) : null;
        if (!pending || pending.instanceId !== auth.row.id) {
          return json(res, 400, { error: 'invalid_relay_token' });
        }
        store.touchInstance(auth.row.id);
        return json(res, 200, {
          accessToken: pending.accessToken,
          refreshToken: pending.refreshToken,
          expiresAt: pending.expiresAt,
        });
      }

      const partnerMatch = /^\/api\/v1\/instances\/([a-f0-9]+)\/partner\/register$/.exec(path);
      if (partnerMatch && req.method === 'POST') {
        const auth = requireInstanceAuth(store, req, partnerMatch[1]);
        if (auth.error) return json(res, auth.status, { error: auth.error });
        if (!auth.row.publicKeyPem) {
          return json(res, 400, { error: 'public_key_not_uploaded' });
        }
        const partnerDomain = instanceHostname(auth.row.id, config.baseDomain);
        const regions = config.tesla.region === 'CN' ? ['CN'] : ['NA', 'EU'];
        const registered = [];
        const errors = [];
        for (const region of regions) {
          try {
            await registerPartnerDomain(config, region, partnerDomain);
            registered.push(region);
          } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
          }
        }
        if (registered.length === 0) {
          return json(res, 502, { error: 'partner_registration_failed', details: errors });
        }
        store.touchInstance(auth.row.id);
        return json(res, 200, { ok: true, registeredRegions: registered, partnerDomain });
      }

      const infoMatch = /^\/api\/v1\/instances\/([a-f0-9]+)$/.exec(path);
      if (infoMatch && req.method === 'GET') {
        const auth = requireInstanceAuth(store, req, infoMatch[1]);
        if (auth.error) return json(res, auth.status, { error: auth.error });
        store.touchInstance(auth.row.id);
        return json(res, 200, {
          ...instanceUrls(config, auth.row.id),
          lastSeenAt: auth.row.lastSeenAt,
          hasPublicKey: !!auth.row.publicKeyPem,
        });
      }

      if (path === '/health' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          instances: store.listInstances().length,
          cloudflare: cloudflare.enabled,
          allowedIps: config.allowedIps.allowAll ? '*' : config.allowedIps.entries,
          inactivityDays: config.inactivityDays,
          cleanupIntervalHours: config.cleanupIntervalHours,
        });
      }

      json(res, 404, { error: 'not_found' });
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : 'internal_error' });
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(`Tesla Desktop Relay listening on http://${config.host}:${config.port}`);
    console.log(`Base domain: ${config.baseDomain}`);
    console.log(`OAuth host: ${config.oauthHost}`);
    console.log(`Cloudflare DNS: ${cloudflare.enabled ? 'enabled' : 'disabled'}`);
    console.log(
      `Registration IPs: ${config.allowedIps.allowAll ? '*' : config.allowedIps.entries.join(', ')}`,
    );
    console.log(
      `Inactivity cleanup: ${config.inactivityDays} days (every ${config.cleanupIntervalHours}h)`,
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
