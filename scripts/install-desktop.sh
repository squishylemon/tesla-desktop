#!/usr/bin/env sh
set -eu

REPO="${TESLA_DESKTOP_REPO:-squishylemon/tesla-desktop}"
RAW="https://raw.githubusercontent.com/${REPO}/main"
INSTALL_DIR="${TESLA_DESKTOP_DIR:-./tesla-desktop}"

RELAY_API_URL="${RELAY_API_URL:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --relay-url) RELAY_API_URL="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# shellcheck source=lib/docker.sh
. "$(dirname "$0")/lib/docker.sh" 2>/dev/null || {
  _DOCKER_LIB="$(mktemp 2>/dev/null || echo /tmp/tesla-desktop-docker.sh)"
  curl -fsSL "${RAW}/scripts/lib/docker.sh" -o "$_DOCKER_LIB"
  # shellcheck source=/dev/null
  . "$_DOCKER_LIB"
  rm -f "$_DOCKER_LIB"
}

if [ -z "$RELAY_API_URL" ]; then
  echo "RELAY_API_URL is required."
  echo ""
  echo "curl -fsSL ${RAW}/scripts/install-desktop.sh | sh -s -- --relay-url https://auth.example.com"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

curl -fsSL "${RAW}/compose/desktop.yml" -o compose.yml

if [ ! -f .env ]; then
  curl -fsSL "${RAW}/.env.example" -o .env
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
    grep -v '^SESSION_SECRET=' .env > .env.tmp
    echo "SESSION_SECRET=${SECRET}" >> .env.tmp
    mv .env.tmp .env
  fi
fi

grep -v '^RELAY_API_URL=' .env | grep -v '^# RELAY_API_URL=' > .env.tmp || true
echo "RELAY_API_URL=${RELAY_API_URL}" >> .env.tmp
mv .env.tmp .env

echo "Pulling images..."
docker_compose -f compose.yml pull

echo "Starting Tesla Desktop..."
docker_compose -f compose.yml up -d

echo ""
echo "Tesla Desktop: https://localhost:4321"
echo "Accept the self-signed certificate warning, then complete /setup"
echo ""
echo "Logs: cd ${INSTALL_DIR} && docker compose -f compose.yml logs -f app"
