# Tesla Desktop Relay

Hosts your domain for home Tesla Desktop installs. Home users browse `localhost:4321`; the relay handles instance subdomains, public key hosting, and OAuth callbacks.

## Quick start

```bash
npm run cloudsetup
```

Edit `relay/.env`, then put the relay behind HTTPS on port 443 (Caddy, nginx, or Cloudflare proxy).

## relay/.env

```env
ALLOWED_IPS=*                              # who can register new instances
RELAY_BASE_DOMAIN=tesla-desktop.example.com
RELAY_OAUTH_HOST=auth.tesla-desktop.example.com
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
RELAY_DNS_TARGET=<this server's public IPv4>
RELAY_INACTIVITY_DAYS=30
RELAY_CLEANUP_INTERVAL_HOURS=6
```

`ALLOWED_IPS`: `*` for public use, or your IP / CIDR to restrict new registrations.

## DNS

One fixed record for OAuth callbacks:

```
auth.tesla-desktop.example.com  →  your relay server
```

Per-instance records (`abc123.yourdomain.com`) are created automatically via Cloudflare.

## Tesla developer portal

Each home user adds these to **their own** Tesla app (shown during setup):

| Field | Value |
|-------|-------|
| Allowed Origin | `https://auth.yourdomain.com` |
| Redirect URL | `https://auth.yourdomain.com/auth/callback` |

## Cleanup

No heartbeat for `RELAY_INACTIVITY_DAYS` (default 30) → DNS record and instance data removed. Cleanup runs every `RELAY_CLEANUP_INTERVAL_HOURS` (default 6).

## Commands

```bash
docker compose --profile cloudsetup up --build -d
docker compose --profile cloudsetup logs -f relay
curl http://localhost:8443/health
```
