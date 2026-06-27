# Tesla Desktop

Self-hosted dashboard for Tesla vehicles. Uses the [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api) for garage view, live status, climate, charging, location, and remote commands.

Not affiliated with Tesla, Inc.

## What you need

- [Docker](https://docs.docker.com/get-docker/)
- A [Tesla developer account](https://developer.tesla.com) with a Fleet API application
- A relay URL (`RELAY_API_URL`) — run your own (below) or use one from your operator

## Install

### Tesla Desktop (home)

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/squishylemon/tesla-desktop/main/scripts/install-desktop.sh | sh -s -- --relay-url https://auth.yourdomain.com
```

Pulls `ghcr.io/squishylemon/tesla-desktop/desktop:latest`, starts the stack, opens at `https://localhost:4321`.

Setup:

1. Connect to the relay
2. Add the shown URLs to [developer.tesla.com](https://developer.tesla.com)
3. Enter your Client ID and Secret
4. Register domain, sign in, pair virtual key

---

### Relay (operator)

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/squishylemon/tesla-desktop/main/scripts/install-relay.sh | sh
```

Pulls `ghcr.io/squishylemon/tesla-desktop/relay:latest`. Edit `tesla-desktop-relay/.env`, point DNS at your server, recreate the container.

```bash
cd tesla-desktop-relay
docker compose -f compose.yml up -d --force-recreate
```

See [relay/README.md](relay/README.md) for `ALLOWED_IPS`, Cloudflare, and cleanup settings.

---

### From source (developers)

```bash
git clone https://github.com/squishylemon/tesla-desktop.git
cd tesla-desktop
cp .env.example .env
docker compose up --build
```

Relay from source:

```bash
cp relay/.env.example relay/.env
docker compose --profile cloudsetup up --build -d
```

---

## Docker images

Published to GitHub Container Registry on push to `main` and on version tags (`v*`):

| Image | Use |
|-------|-----|
| `ghcr.io/squishylemon/tesla-desktop/desktop:latest` | Home install |
| `ghcr.io/squishylemon/tesla-desktop/relay:latest` | Relay operator |

After the first workflow run, set each package to **public** under GitHub → Packages → Package settings → Change visibility.

## Local development

```bash
npm install
cp .env.example .env
npm run build
node scripts/start-https.mjs
```

## License

Unofficial project — not affiliated with Tesla, Inc.
