export function startCleanupJob({ store, cloudflare, config, log = console.log }) {
  const ms = config.cleanupIntervalHours * 60 * 60 * 1000;
  const cutoffMs = config.inactivityDays * 24 * 60 * 60 * 1000;

  async function run() {
    store.purgeExpiredOAuth();
    const now = Date.now();
    const stale = store.listInstances().filter((row) => now - row.lastSeenAt > cutoffMs);

    for (const row of stale) {
      try {
        if (cloudflare.enabled && row.cloudflareRecordId) {
          await cloudflare.deleteInstanceRecord(row.cloudflareRecordId);
        }
        store.deleteInstance(row.id);
        log(`[cleanup] Removed inactive instance ${row.id} (last seen ${new Date(row.lastSeenAt).toISOString()})`);
      } catch (e) {
        log(`[cleanup] Failed to remove ${row.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  run().catch((e) => log(`[cleanup] ${e}`));
  return setInterval(() => {
    run().catch((e) => log(`[cleanup] ${e}`));
  }, ms);
}
