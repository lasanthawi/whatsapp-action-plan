const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY?.trim();

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function getSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase configuration');
  }

  return {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
  };
}

export async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  const { url, key } = getSupabaseConfig();

  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}

export async function supabaseJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await supabaseFetch(path, init);
  if (!response.ok) {
    throw new Error(await readSupabaseError(response));
  }
  return (await response.json()) as T;
}

export async function readSupabaseError(response: Response) {
  const text = await response.text();
  if (!text) {
    return `Supabase request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return parsed.message || parsed.error || text;
  } catch {
    return text;
  }
}
