import { createServer as createHttpsServer } from 'node:https';
import { timingSafeEqual } from 'node:crypto';
import { getConfig, instanceHostname, parseInstanceFromHost } from './config.js';
import { createStore } from './store.js';
import { createCloudflareClient } from './cloudflare.js';
import { startCleanupJob } from './cleanup.js';
import { getClientIp, isIpAllowed } from './allowed-ips.js';
import { loadTlsCredentials } from './tls.js';

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

function decodeState(state) {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
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
  });
}

async function main() {
  const config = getConfig();
  const tls = loadTlsCredentials(config.tlsKeyPath, config.tlsCertPath);
  const store = createStore(config.storePath);
  const cloudflare = createCloudflareClient(config);

  startCleanupJob({ store, cloudflare, config });

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `https://${req.headers.host}`);
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

      // --- OAuth callback: forwards code to localhost (token exchange stays on home install) ---
      if (path === '/auth/callback' && req.method === 'GET') {
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const stateRaw = url.searchParams.get('state');
        const parsed = stateRaw ? decodeState(stateRaw) : null;
        const returnUrl = parsed?.returnUrl ?? 'https://localhost:4321/auth/relay-complete';

        if (error) {
          const loc = new URL(returnUrl);
          loc.searchParams.set('error', error);
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        }

        if (!code) {
          const loc = new URL(returnUrl);
          loc.searchParams.set('error', 'missing_code');
          res.writeHead(302, { Location: loc.toString() });
          return res.end();
        }

        if (parsed?.instanceId && store.getInstance(parsed.instanceId)) {
          store.touchInstance(parsed.instanceId);
        }

        const loc = new URL(returnUrl);
        loc.searchParams.set('code', code);
        if (stateRaw) loc.searchParams.set('state', stateRaw);
        res.writeHead(302, { Location: loc.toString() });
        return res.end();
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
  };

  const server = createHttpsServer(tls, handler);

  server.listen(config.port, config.host, () => {
    console.log(`Tesla Desktop Relay listening on https://${config.host}:${config.port}`);
    console.log(`OAuth origin: ${config.oauthOrigin}`);
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
