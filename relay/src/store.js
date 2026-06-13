import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

function defaultStore() {
  return { instances: {}, pendingOAuth: {} };
}

export function createStore(storePath) {
  let data = defaultStore();

  function load() {
    try {
      data = JSON.parse(readFileSync(storePath, 'utf8'));
      data.instances ??= {};
      data.pendingOAuth ??= {};
    } catch {
      data = defaultStore();
      persist();
    }
  }

  function persist() {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  }

  load();

  return {
    createInstance({ cloudflareRecordId = null }) {
      const id = randomBytes(6).toString('hex');
      const secret = randomBytes(32).toString('hex');
      const now = Date.now();
      data.instances[id] = {
        id,
        secret,
        publicKeyPem: null,
        cloudflareRecordId,
        createdAt: now,
        lastSeenAt: now,
      };
      persist();
      return data.instances[id];
    },

    getInstance(id) {
      return data.instances[id] ?? null;
    },

    listInstances() {
      return Object.values(data.instances);
    },

    touchInstance(id) {
      const row = data.instances[id];
      if (!row) return null;
      row.lastSeenAt = Date.now();
      persist();
      return row;
    },

    setPublicKey(id, publicKeyPem) {
      const row = data.instances[id];
      if (!row) return null;
      row.publicKeyPem = publicKeyPem;
      row.lastSeenAt = Date.now();
      persist();
      return row;
    },

    setCloudflareRecordId(id, recordId) {
      const row = data.instances[id];
      if (!row) return null;
      row.cloudflareRecordId = recordId;
      persist();
      return row;
    },

    deleteInstance(id) {
      const row = data.instances[id];
      if (!row) return null;
      delete data.instances[id];
      persist();
      return row;
    },

    savePendingOAuth(token, payload) {
      data.pendingOAuth[token] = { ...payload, expiresAt: Date.now() + 5 * 60 * 1000 };
      persist();
    },

    consumePendingOAuth(token) {
      const row = data.pendingOAuth[token];
      if (!row) return null;
      delete data.pendingOAuth[token];
      if (row.expiresAt < Date.now()) return null;
      persist();
      return row;
    },

    purgeExpiredOAuth() {
      const now = Date.now();
      let changed = false;
      for (const [token, row] of Object.entries(data.pendingOAuth)) {
        if (row.expiresAt < now) {
          delete data.pendingOAuth[token];
          changed = true;
        }
      }
      if (changed) persist();
    },
  };
}
