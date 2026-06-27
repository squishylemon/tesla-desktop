#!/usr/bin/env sh
set -eu

REPO="${TESLA_DESKTOP_REPO:-squishylemon/tesla-desktop}"
RAW="https://raw.githubusercontent.com/${REPO}/main"
INSTALL_DIR="${TESLA_DESKTOP_RELAY_DIR:-./tesla-desktop-relay}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ ! -f compose.yml ]; then
  curl -fsSL "${RAW}/compose/relay.yml" -o compose.yml
fi

if [ ! -f .env ]; then
  curl -fsSL "${RAW}/relay/.env.example" -o .env
  echo ""
  echo "Created .env — edit it before going live:"
  echo "  ALLOWED_IPS, RELAY_BASE_DOMAIN, RELAY_OAUTH_HOST"
  echo "  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, RELAY_DNS_TARGET"
  echo ""
fi

echo "Pulling image..."
docker compose -f compose.yml pull

echo "Starting relay..."
docker compose -f compose.yml up -d

echo ""
echo "Relay is running on port ${RELAY_PORT:-8443}"
echo "Health: curl http://localhost:${RELAY_PORT:-8443}/health"
echo ""
echo "Edit .env in ${INSTALL_DIR}, then: docker compose -f compose.yml up -d --force-recreate"
echo "Logs: docker compose -f compose.yml logs -f relay"
