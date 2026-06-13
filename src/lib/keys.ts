import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEnv } from '@/env';
import { getDeveloperConfig } from '@/lib/db';
import { getPublicKeyCheckUrl, getPublicOrigin } from '@/lib/tesla/partner';

const PUBLIC_KEY_WELL_KNOWN = 'com.tesla.3p.public-key.pem';

export function getKeysDir(): string {
  return join(getEnv().dataDir, 'keys');
}

export function getFleetKeyPath(): string {
  return join(getKeysDir(), 'fleet-key.pem');
}

export function getFleetPublicKeyPath(): string {
  return join(getKeysDir(), 'fleet-key.pub.pem');
}

export function getTlsKeyPath(): string {
  return join(getEnv().dataDir, 'tls-key.pem');
}

export function getTlsCertPath(): string {
  return join(getEnv().dataDir, 'tls-cert.pem');
}

export function ensureKeyPair(): { publicKeyPath: string; privateKeyPath: string } {
  const keysDir = getKeysDir();
  const privateKeyPath = getFleetKeyPath();
  const publicKeyPath = getFleetPublicKeyPath();

  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }

  if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
    execSync(`openssl ecparam -name prime256v1 -genkey -noout -out "${privateKeyPath}"`, {
      stdio: 'pipe',
    });
    execSync(`openssl ec -in "${privateKeyPath}" -pubout -out "${publicKeyPath}"`, {
      stdio: 'pipe',
    });
  }

  syncPublicKeyToWellKnown(publicKeyPath);
  return { publicKeyPath, privateKeyPath };
}

export function getAppTlsKeyPath(): string {
  return join(getEnv().dataDir, 'app-tls-key.pem');
}

export function getAppTlsCertPath(): string {
  return join(getEnv().dataDir, 'app-tls-cert.pem');
}

export function ensureAppTlsCerts(hostname?: string): void {
  const { dataDir, tlsHostname } = getEnv();
  const cn = hostname ?? tlsHostname;
  const keyPath = getAppTlsKeyPath();
  const certPath = getAppTlsCertPath();

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(keyPath) && existsSync(certPath)) {
    return;
  }

  const san = ['DNS:localhost', 'DNS:127.0.0.1', `DNS:${cn}`, 'IP:127.0.0.1'];
  const opensslConfig = join(dataDir, 'app-tls-openssl.cnf');
  writeFileSync(
    opensslConfig,
    `[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${cn}

[v3_req]
subjectAltName = ${san.join(', ')}
`,
  );

  execSync(
    `openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -pkeyopt ec_param_enc:named_curve -days 3650 -keyout "${keyPath}" -out "${certPath}" -config "${opensslConfig}" -extensions v3_req`,
    { stdio: 'pipe' },
  );
}

export function ensureTlsCerts(): void {
  const { dataDir } = getEnv();
  const keyPath = getTlsKeyPath();
  const certPath = getTlsCertPath();

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    execSync(
      `openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -pkeyopt ec_param_enc:named_curve -subj "/CN=localhost" -keyout "${keyPath}" -out "${certPath}" -sha256 -days 3650`,
      { stdio: 'pipe' },
    );
  }
}

export function syncPublicKeyToWellKnown(publicKeyPath?: string): void {
  const src = publicKeyPath ?? getFleetPublicKeyPath();
  if (!existsSync(src)) return;

  const destDir = join(process.cwd(), 'public', '.well-known', 'appspecific');
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const dest = join(destDir, PUBLIC_KEY_WELL_KNOWN);
  copyFileSync(src, dest);
}

export function getPublicKeyContent(): string | null {
  const path = getFleetPublicKeyPath();
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function getPublicKeyUrl(redirectUri?: string): string {
  const config = getDeveloperConfig();
  if (config) return getPublicKeyCheckUrl(config);
  const origin = redirectUri ? getPublicOrigin(redirectUri) : 'https://localhost:4321';
  return `${origin}/.well-known/appspecific/${PUBLIC_KEY_WELL_KNOWN}`;
}
