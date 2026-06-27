#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
export DATA_DIR

mkdir -p "$DATA_DIR"

TLS_KEY="${RELAY_TLS_KEY:-$DATA_DIR/relay-tls-key.pem}"
TLS_CERT="${RELAY_TLS_CERT:-$DATA_DIR/relay-tls-cert.pem}"
OAUTH_HOST="${RELAY_OAUTH_HOST:-localhost}"
BASE_DOMAIN="${RELAY_BASE_DOMAIN:-localhost}"

if [ ! -f "$TLS_KEY" ] || [ ! -f "$TLS_CERT" ]; then
  if [ -z "$RELAY_TLS_KEY" ] && [ -z "$RELAY_TLS_CERT" ]; then
    echo "Generating relay HTTPS certificate for ${OAUTH_HOST} and *.${BASE_DOMAIN}..."
    SAN="DNS:${OAUTH_HOST},DNS:${BASE_DOMAIN},DNS:*.${BASE_DOMAIN},DNS:localhost,IP:127.0.0.1"
    cat > "$DATA_DIR/relay-tls-openssl.cnf" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = ${OAUTH_HOST}
[v3_req]
subjectAltName = ${SAN}
EOF
    openssl req -x509 -nodes -newkey ec \
      -pkeyopt ec_paramgen_curve:prime256v1 \
      -pkeyopt ec_param_enc:named_curve \
      -days 3650 \
      -keyout "$TLS_KEY" \
      -out "$TLS_CERT" \
      -config "$DATA_DIR/relay-tls-openssl.cnf" \
      -extensions v3_req
  else
    echo "Missing TLS files: $TLS_KEY $TLS_CERT"
    exit 1
  fi
fi

chmod 644 "$TLS_KEY" "$TLS_CERT" 2>/dev/null || true

export RELAY_TLS_KEY="$TLS_KEY"
export RELAY_TLS_CERT="$TLS_CERT"

echo "Starting Tesla Desktop Relay (HTTPS)..."
exec node /app/src/server.js
