export async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await readError(response, `${url} returned ${response.status}`));
  }
  return response.json() as Promise<T>;
}

export function fetchJson<T>(url: string): Promise<T> {
  return requestJson<T>(url);
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function putJson<T>(url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
