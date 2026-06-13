# Tesla Desktop

Self-hosted dashboard for Tesla vehicles. Uses the [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api) for garage view, live status, climate, charging, location, and remote commands.

Not affiliated with Tesla, Inc.

## What you need

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Tesla developer account](https://developer.tesla.com) with a Fleet API application, billing set up, and these scopes: `openid`, `offline_access`, `user_data`, `vehicle_device_data`, `vehicle_location`, `vehicle_cmds`, `vehicle_charging_cmds`
- A relay URL (`RELAY_API_URL`) — run your own with the cloud install below, or use one provided by your operator

Vehicle commands require virtual key pairing in the Tesla app.

## Install

### Home install (Tesla Desktop)

```bash
cp .env.example .env
docker compose up --build
```

Set `RELAY_API_URL` in `.env` to your relay (e.g. `https://auth.tesla-desktop.example.com`).

Open `https://localhost:4321` and accept the self-signed certificate warning.

Setup flow:

1. Connect to the relay — creates your instance subdomain and uploads your public key
2. Copy the generated URLs into your app on [developer.tesla.com](https://developer.tesla.com) (Allowed Origin + Redirect URL)
3. Enter your Client ID and Secret
4. Register domain with Tesla
5. Sign in and pair your virtual key from the garage page

You browse the app at localhost. Tesla OAuth and partner registration go through the relay.

---

### Cloud install (relay)

For operators hosting the shared domain.

```bash
npm run cloudsetup
```

Edit `relay/.env`, then point DNS at your server:

```
auth.tesla-desktop.example.com  →  your server
```

On [developer.tesla.com](https://developer.tesla.com), each home user adds the relay URLs to **their own** Tesla application. The relay operator does not need a Fleet API app in `relay/.env`.

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
