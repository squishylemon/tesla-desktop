import type { APIRoute } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { ensureKeyPair, getFleetPublicKeyPath } from '@/lib/keys';

export const GET: APIRoute = async () => {
  ensureKeyPair();
  const path = getFleetPublicKeyPath();

  if (!existsSync(path)) {
    return new Response('Public key not generated yet. Complete setup first.', { status: 404 });
  }

  const pem = readFileSync(path, 'utf8');
  return new Response(pem, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
