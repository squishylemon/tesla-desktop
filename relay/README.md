# Tesla Desktop Relay

Hosts your domain for home users running Tesla Desktop locally (`localhost:4321`).

## Quick start (domain operator)

```bash
npm run cloudsetup
```

This will:
1. Copy `relay/.env.example` → `relay/.env` (if missing)
2. Build and start the relay container: `docker compose --profile cloudsetup up --build -d`

Edit `relay/.env` before going live.

### Minimum `relay/.env` checklist

```env
ALLOWED_IPS=*                          # or 203.0.113.50 for your IP only
RELAY_BASE_DOMAIN=tesla-desktop.example.com
RELAY_OAUTH_HOST=auth.tesla-desktop.example.com
TESLA_CLIENT_ID=...
TESLA_CLIENT_SECRET=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
RELAY_DNS_TARGET=<this server's public IPv4>
RELAY_INACTIVITY_DAYS=30
RELAY_CLEANUP_INTERVAL_HOURS=6
```

### DNS (manual, one-time)

```
auth.tesla-desktop.example.com  →  A  →  your relay server
```

Enable Cloudflare proxy (orange cloud) for HTTPS.

### Tesla developer portal (once)

| Field | Value |
|-------|-------|
| Allowed Origin | `https://auth.tesla-desktop.example.com` |
| Redirect URL | `https://auth.tesla-desktop.example.com/auth/callback` |

## `ALLOWED_IPS`

Controls who can **register new home instances** (create a subdomain on your domain).

| Value | Meaning |
|-------|---------|
| `*` | Anyone can use your relay (public homelab product) |
| `203.0.113.50` | Only that IP can register (personal use) |
| `203.0.113.0/24,198.51.100.5` | Multiple IPs or CIDR ranges |

Heartbeats and OAuth from existing instances are not blocked — only **new** registrations.

## Cleanup

Inactive instances (no heartbeat) are removed after `RELAY_INACTIVITY_DAYS` (default **30**).

The cleanup job runs every `RELAY_CLEANUP_INTERVAL_HOURS` (default **6**).

Removes:
- Cloudflare DNS record for `{instanceId}.yourdomain.com`
- Instance data and public key from relay storage

Home installs send heartbeats every 12 hours while the app runs.

## Commands

```bash
# Start / rebuild
npm run cloudsetup
# or
docker compose --profile cloudsetup up --build -d

# Logs
docker compose --profile cloudsetup logs -f relay

# Stop
docker compose --profile cloudsetup down

# Health
curl http://localhost:8443/health
```

## Home install configuration

Users add to their Tesla Desktop `.env`:

```env
RELAY_API_URL=https://auth.tesla-desktop.example.com
RELAY_SHARED_CLIENT_ID=<same as relay TESLA_CLIENT_ID>
RELAY_SHARED_CLIENT_SECRET=<same as relay TESLA_CLIENT_SECRET>
```

They keep browsing `https://localhost:4321` — no domain or port forwarding needed.
