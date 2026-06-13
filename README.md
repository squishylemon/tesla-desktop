# Tesla Desktop

Self-hosted dashboard for Tesla vehicles. Uses the [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api) for garage view, live status, climate, charging, location, and remote commands.

Not affiliated with Tesla, Inc.

## What you need

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Tesla developer account](https://developer.tesla.com) with a Fleet API application, billing set up, and these scopes: `openid`, `offline_access`, `user_data`, `vehicle_device_data`, `vehicle_location`, `vehicle_cmds`, `vehicle_charging_cmds`

Vehicle commands require virtual key pairing in the Tesla app.

## Install

There are two parts to this project:

1. **Tesla Desktop** — runs at home on `localhost:4321`
2. **Relay** (optional) — runs on your server and domain so home users do not need their own hostname or port forwarding

Most people only need the home install. Run the relay if you want to host a shared domain for yourself or others.

---

### Home install (Tesla Desktop)

```bash
cp .env.example .env
docker compose up --build
```

Open `https://localhost:4321` and accept the self-signed certificate warning.

Walk through `/setup`:

1. Enter your Tesla developer Client ID and Secret
2. Set a partner hostname (your own domain with port 4321 forwarded — `localhost` will not work for Tesla registration)
3. Add the shown Allowed Origin and Redirect URL on [developer.tesla.com](https://developer.tesla.com)
4. Register domain, sign in, pair your virtual key from the garage page

If you use a relay (below), skip the hostname step and set relay variables in `.env` instead:

```env
RELAY_API_URL=https://auth.yourdomain.com
RELAY_SHARED_CLIENT_ID=your-client-id
RELAY_SHARED_CLIENT_SECRET=your-client-secret
RELAY_SHARED_REGION=NA
```

Then run setup normally — it connects to the relay for OAuth and partner registration while you keep using `localhost:4321`.

Useful `.env` values for a standalone home install:

```env
SESSION_SECRET=...          # openssl rand -hex 32
TESLA_DOMAIN=tesla.home.example.com
```

---

### Cloud install (relay)

For operators who own a domain and want home installs to use it for Tesla OAuth and partner registration.

```bash
npm run cloudsetup
```

That copies `relay/.env.example` to `relay/.env` (if needed) and runs:

```bash
docker compose --profile cloudsetup up --build -d
```

Edit `relay/.env` before relying on it in production:

```env
ALLOWED_IPS=*                              # * = open registration; or your IP / CIDR
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

Point DNS at the relay server:

```
auth.tesla-desktop.example.com  →  your server
```

On [developer.tesla.com](https://developer.tesla.com), add once (shared by all home installs):

| Field | Value |
|-------|-------|
| Allowed Origin | `https://auth.tesla-desktop.example.com` |
| Redirect URL | `https://auth.tesla-desktop.example.com/auth/callback` |

Each home install gets a subdomain like `abc123.tesla-desktop.example.com` for its public key and virtual key pairing. Cloudflare creates those records automatically.

Instances with no heartbeat for `RELAY_INACTIVITY_DAYS` are removed (DNS record and stored data).

Relay commands:

```bash
docker compose --profile cloudsetup logs -f relay
docker compose --profile cloudsetup down
curl http://localhost:8443/health
```

More detail: [relay/README.md](relay/README.md)

---

## Local development (without Docker)

```bash
npm install
cp .env.example .env
npm run build
node scripts/start-https.mjs
```

Requires OpenSSL on your PATH.

## License

Unofficial project — not affiliated with Tesla, Inc.
