// filepath: src/shared/core/apiClient.ts
type Json = unknown;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

function joinUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE) return url;
  return `${API_BASE.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

function buildQS(params?: Record<string, unknown>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v)) v.forEach((x) => x != null && usp.append(k, String(x)));
    else usp.set(k, String(v));
  }
  return usp.toString();
}

async function parseJsonSafe(res: Response): Promise<Json> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickErrorMessage(obj: Record<string, unknown>): string | undefined {
  const keys = ['message', 'error', 'msg', 'detail', 'reason'];
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === 'string' && val.trim()) return val;
    if (isRecord(val)) {
      const nested = pickErrorMessage(val);
      if (nested) return nested;
    }
  }
  return undefined;
}

function toErr(status: number, body: Json): string {
  const base = `HTTP ${status}`;
  if (typeof body === 'string' && body) return `${base} - ${body}`;
  if (isRecord(body)) {
    const m = pickErrorMessage(body);
    if (m) return `${base} - ${m}`;
  }
  return base;
}

export async function getJson<T = Json>(
  url: string,
  opts?: { params?: Record<string, unknown>; signal?: AbortSignal }
): Promise<T> {
  const qs = buildQS(opts?.params);
  const href = joinUrl(qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url);

  const init: RequestInit = {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    mode: 'cors',
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };

  const res = await fetch(href, init);
  const body = await parseJsonSafe(res);
  if (!res.ok) throw new Error(toErr(res.status, body));
  return body as T;
}

export async function postJson<T = Json>(
  url: string,
  body: unknown,
  opts?: { signal?: AbortSignal }
): Promise<T> {
  const href = joinUrl(url);

  const init: RequestInit = {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    mode: 'cors',
    body: JSON.stringify(body ?? {}),
    ...(opts?.signal ? { signal: opts.signal } : {}),
  };

  const res = await fetch(href, init);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(toErr(res.status, data));
  return data as T;
}
