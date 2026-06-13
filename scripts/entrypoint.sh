#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
export DATA_DIR

mkdir -p "$DATA_DIR/keys"

# Generate fleet EC key pair if missing
if [ ! -f "$DATA_DIR/keys/fleet-key.pem" ]; then
  echo "Generating fleet key pair..."
  openssl ecparam -name prime256v1 -genkey -noout -out "$DATA_DIR/keys/fleet-key.pem"
  openssl ec -in "$DATA_DIR/keys/fleet-key.pem" -pubout -out "$DATA_DIR/keys/fleet-key.pub.pem"
fi

# TLS for vehicle-command proxy
if [ ! -f "$DATA_DIR/tls-key.pem" ]; then
  echo "Generating vehicle-command TLS certificates..."
  openssl req -x509 -nodes -newkey ec \
    -pkeyopt ec_paramgen_curve:prime256v1 \
    -pkeyopt ec_param_enc:named_curve \
    -subj "/CN=localhost" \
    -keyout "$DATA_DIR/tls-key.pem" \
    -out "$DATA_DIR/tls-cert.pem" \
    -sha256 -days 3650
fi

# Self-signed TLS for the web app (HTTPS)
TLS_HOST="${TESLA_TLS_HOSTNAME:-${TESLA_DOMAIN:-localhost}}"
if [ ! -f "$DATA_DIR/app-tls-key.pem" ]; then
  echo "Generating app HTTPS certificate for ${TLS_HOST}..."
  cat > "$DATA_DIR/app-tls-openssl.cnf" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = ${TLS_HOST}
[v3_req]
subjectAltName = DNS:localhost, DNS:127.0.0.1, DNS:${TLS_HOST}, IP:127.0.0.1
EOF
  openssl req -x509 -nodes -newkey ec \
    -pkeyopt ec_paramgen_curve:prime256v1 \
    -pkeyopt ec_param_enc:named_curve \
    -days 3650 \
    -keyout "$DATA_DIR/app-tls-key.pem" \
    -out "$DATA_DIR/app-tls-cert.pem" \
    -config "$DATA_DIR/app-tls-openssl.cnf" \
    -extensions v3_req
fi

chmod 755 "$DATA_DIR" "$DATA_DIR/keys" 2>/dev/null || true
chmod 644 "$DATA_DIR/keys/fleet-key.pem" "$DATA_DIR/keys/fleet-key.pub.pem" 2>/dev/null || true
chmod 644 "$DATA_DIR/tls-key.pem" "$DATA_DIR/tls-cert.pem" 2>/dev/null || true
chmod 644 "$DATA_DIR/app-tls-key.pem" "$DATA_DIR/app-tls-cert.pem" 2>/dev/null || true
cp -f "$DATA_DIR/keys/fleet-key.pem" "$DATA_DIR/fleet-key.pem"
chmod 644 "$DATA_DIR/fleet-key.pem"

for WELLKNOWN_DIR in "/app/public/.well-known/appspecific" "/app/dist/client/.well-known/appspecific"; do
  mkdir -p "$WELLKNOWN_DIR"
  cp -f "$DATA_DIR/keys/fleet-key.pub.pem" "$WELLKNOWN_DIR/com.tesla.3p.public-key.pem" 2>/dev/null || true
done

export VEHICLE_COMMAND_PROXY_CA="${VEHICLE_COMMAND_PROXY_CA:-$DATA_DIR/tls-cert.pem}"
export APP_TLS_KEY="${APP_TLS_KEY:-$DATA_DIR/app-tls-key.pem}"
export APP_TLS_CERT="${APP_TLS_CERT:-$DATA_DIR/app-tls-cert.pem}"
export ENABLE_HTTPS="${ENABLE_HTTPS:-true}"

echo "Starting Tesla Desktop (HTTPS)..."
if [ "$ENABLE_HTTPS" = "true" ]; then
  # entry.mjs auto-starts HTTP on PORT; remove that block so start-https.mjs owns the port
  sed -i '/if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start))/,/^}$/d' /app/dist/server/entry.mjs
  exec node ./scripts/start-https.mjs
else
  exec node ./dist/server/entry.mjs
fi
