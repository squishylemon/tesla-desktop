const API = 'https://api.cloudflare.com/client/v4';

export function createCloudflareClient(config) {
  const { apiToken, zoneId, recordType, recordTarget, proxied } = config.cloudflare;

  if (!apiToken || !zoneId || !recordTarget) {
    return {
      enabled: false,
      async createInstanceRecord() {
        return { id: null, skipped: true };
      },
      async deleteInstanceRecord() {
        return { skipped: true };
      },
    };
  }

  async function cf(path, init = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const json = await res.json();
    if (!json.success) {
      const msg = json.errors?.map((e) => e.message).join('; ') ?? res.statusText;
      throw new Error(`Cloudflare API: ${msg}`);
    }
    return json.result;
  }

  return {
    enabled: true,

    /** Creates {instanceId}.baseDomain → RELAY_DNS_TARGET */
    async createInstanceRecord(instanceId, baseDomain) {
      const name = instanceId;
      const result = await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: recordType,
          name,
          content: recordTarget,
          ttl: 1,
          proxied,
        }),
      });
      return { id: result.id, name: result.name };
    },

    async deleteInstanceRecord(recordId) {
      if (!recordId) return { skipped: true };
      await cf(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
      return { deleted: true };
    },
  };
}
