export interface TeslaErrorBody {
  response?: unknown;
  error?: string | null;
  error_description?: string | null;
  message?: string;
}

/** Extract a human-readable message from Tesla API / OAuth error bodies */
export function formatTeslaError(
  body: TeslaErrorBody | string | null | undefined,
  status: number,
  fallback: string,
): string {
  if (!body) {
    return `${fallback} (HTTP ${status})`;
  }

  if (typeof body === 'string') {
    const trimmed = body.trim();
    return trimmed || `${fallback} (HTTP ${status})`;
  }

  const msg =
    body.error_description?.trim() ||
    body.error?.trim() ||
    body.message?.trim() ||
    '';

  if (msg) {
    return status ? `${msg} (HTTP ${status})` : msg;
  }

  return `${fallback} (HTTP ${status})`;
}

export async function readTeslaError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  if (!text.trim()) {
    return formatTeslaError(null, res.status, fallback);
  }

  try {
    return formatTeslaError(JSON.parse(text) as TeslaErrorBody, res.status, fallback);
  } catch {
    return formatTeslaError(text, res.status, fallback);
  }
}
