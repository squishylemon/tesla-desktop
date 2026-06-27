# Tesla Desktop Relay

Docker image: `ghcr.io/squishylemon/tesla-desktop/relay:latest`

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/squishylemon/tesla-desktop/main/scripts/install-relay.sh | sh
```

Creates `tesla-desktop-relay/`, pulls the image, starts the container.

Edit `tesla-desktop-relay/.env`:

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

Apply changes:

```bash
cd tesla-desktop-relay
docker compose -f compose.yml up -d --force-recreate
```

## DNS

```
auth.yourdomain.com  →  your relay server
```

Instance subdomains (`abc123.yourdomain.com`) are created automatically via Cloudflare.

## Home installs

Users set `RELAY_API_URL=https://auth.yourdomain.com` when installing Tesla Desktop.

Each user adds the relay Allowed Origin and Redirect URL to their own Tesla developer application during setup.
