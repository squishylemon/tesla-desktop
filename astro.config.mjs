// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// Omit site when unset so redirects stay relative for local/self-hosted use
const site = process.env.SITE_URL?.trim() || undefined;

export default defineConfig({
  ...(site ? { site } : {}),
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), tailwind()],
  server: {
    host: true,
    port: 4321,
  },
  // Self-hosted behind Docker: browser Origin (localhost) may not match internal request URL
  security: {
    checkOrigin: false,
    allowedDomains: [
      { hostname: 'localhost', protocol: 'http' },
      { hostname: '127.0.0.1', protocol: 'http' },
    ],
  },
});