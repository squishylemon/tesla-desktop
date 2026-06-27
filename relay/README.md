# Tesla Desktop Relay

Docker image: `ghcr.io/squishylemon/tesla-desktop/relay:latest`

Serves **HTTPS only** on port 8443. A self-signed certificate is generated on first run for `RELAY_OAUTH_HOST` and `*.RELAY_BASE_DOMAIN`.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/squishylemon/tesla-desktop/main/scripts/install-relay.sh | sh
```

## relay/.env

```env
ALLOWED_IPS=*
RELAY_BASE_DOMAIN=tesla.example.com
RELAY_OAUTH_HOST=auth.tesla.example.com
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
RELAY_DNS_TARGET=<your server public IPv4>
RELAY_INACTIVITY_DAYS=30
RELAY_CLEANUP_INTERVAL_HOURS=6
```

## DNS and Cloudflare SSL (important)

Cloudflare **Universal SSL** (free) covers:

- `example.com`
- `*.example.com`

It does **not** cover deeper names like `auth.tesla.example.com` or `abc123.tesla.example.com` when your Cloudflare zone is only `example.com`. Those hostnames fail in the browser with **ERR_SSL_VERSION_OR_CIPHER_MISMATCH** even though the relay is running correctly.

### Recommended: delegate a subdomain zone

For `auth.tdesktop.omnicorenetworks.com` and `{id}.tdesktop.omnicorenetworks.com`:

1. In Cloudflare, add a zone for **`tdesktop.omnicorenetworks.com`** (not the apex `omnicorenetworks.com` zone).
2. At your registrar, delegate `tdesktop.omnicorenetworks.com` to Cloudflare’s nameservers.
3. Set relay env:
   - `RELAY_BASE_DOMAIN=tdesktop.omnicorenetworks.com`
   - `RELAY_OAUTH_HOST=auth.tdesktop.omnicorenetworks.com`
   - `CLOUDFLARE_ZONE_ID=<zone id for tdesktop.omnicorenetworks.com>`
4. Create an **A** record `auth` → your server IP (proxied / orange cloud).
5. SSL/TLS mode: **Full** (origin speaks HTTPS on 8443).

Universal SSL on the `tdesktop.omnicorenetworks.com` zone then covers `*.tdesktop.omnicorenetworks.com`.

### Alternative: flat names on the apex zone

If your zone is `omnicorenetworks.com`:

```env
RELAY_BASE_DOMAIN=omnicorenetworks.com
RELAY_OAUTH_HOST=tesla-auth.omnicorenetworks.com
```

Instances become `{instanceId}.omnicorenetworks.com` (one label under the apex). OAuth uses a separate single-level name.

### Origin port

Browsers hit port **443**. Cloudflare connects to your origin on **443** by default. Either:

- Map relay to 443: `RELAY_PORT=443` in compose (requires binding to 443), or
- Run a reverse proxy on 443 → `localhost:8443`, or
- Use Cloudflare Tunnel to your relay port.

Test locally:

```bash
curl -k https://localhost:8443/health
```

With Cloudflare proxy, set SSL mode to **Full** (not Flexible).

## Custom certificates

Mount your own Let's Encrypt or Cloudflare origin certs:

```env
RELAY_TLS_KEY=/data/certs/privkey.pem
RELAY_TLS_CERT=/data/certs/fullchain.pem
```

## Home installs

Users set `RELAY_API_URL=https://auth.yourdomain.com` (port 443 via reverse proxy, or `:8443` if exposed directly).
