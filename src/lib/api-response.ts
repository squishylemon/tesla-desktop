export async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  if (!text) return fallback;

  try {
    const json = JSON.parse(text) as { error?: string; message?: string };
    return json.error ?? json.message ?? fallback;
  } catch {
    return text;
  }
}

export async function readApiJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    throw new Error(await readApiError(res, fallback));
  }
  return res.json() as Promise<T>;
}
