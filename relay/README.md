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
RELAY_BASE_DOMAIN=tesla-desktop.example.com
RELAY_OAUTH_HOST=auth.tesla-desktop.example.com
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
RELAY_DNS_TARGET=<your server public IPv4>
RELAY_INACTIVITY_DAYS=30
RELAY_CLEANUP_INTERVAL_HOURS=6
```

## DNS

```
auth.yourdomain.com  →  your relay server:8443
```

With Cloudflare proxy (orange cloud), use SSL mode **Full** so Cloudflare connects to your origin over HTTPS.

## Custom certificates

Mount your own Let's Encrypt or Cloudflare origin certs:

```env
RELAY_TLS_KEY=/data/certs/privkey.pem
RELAY_TLS_CERT=/data/certs/fullchain.pem
```

## Health check

```bash
curl -k https://localhost:8443/health
```

## Home installs

Users set `RELAY_API_URL=https://auth.yourdomain.com` (port 443 via reverse proxy, or `:8443` if exposed directly).
