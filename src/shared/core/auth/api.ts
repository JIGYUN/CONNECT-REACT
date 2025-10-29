import { postJson } from '@/shared/core/apiClient';

export type LoginInput = { email: string; password: string };
export type LoginResult = { userId: number; name: string | null; email: string | null };

/* ───────────── type guards & pickers ───────────── */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickObj(o: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = o[key];
  return isObject(v) ? (v as Record<string, unknown>) : undefined;
}

function pickNum(o: Record<string, unknown> | undefined, ...keys: string[]): number | null {
  if (!o) return null;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** 다양한 래핑(result/data/user)과 키(userId/USER_ID/id/ID) 모두 흡수 */
function pickUserId(v: unknown): number | null {
  if (!isObject(v)) return null;
  const o = v as Record<string, unknown>;
  const result = pickObj(o, 'result');
  const data = pickObj(o, 'data');
  const user = pickObj(o, 'user');

  const r = pickNum(result, 'userId', 'USER_ID', 'id', 'ID');
  if (r != null) return r;

  const d = pickNum(data, 'userId', 'USER_ID', 'id', 'ID');
  if (d != null) return d;

  const u = pickNum(user, 'userId', 'USER_ID', 'id', 'ID');
  if (u != null) return u;

  return pickNum(o, 'userId', 'USER_ID', 'id', 'ID');
}

function pickStr(o: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!o) return null;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

/* ───────────── API ───────────── */

export async function apiLogin(input: LoginInput): Promise<LoginResult> {
  const data = await postJson<unknown>('/api/auth/selectLogin', input);
  const userId = pickUserId(data);
  if (userId == null) throw new Error('Invalid login response');
  return { userId, name: null, email: input.email };
}

export async function apiLogout(): Promise<{ ok: true }> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
  } catch {
    // ignore
  }
  return { ok: true as const };
}

/** 현재 세션 조회 (없으면 null) */
export async function apiMe(): Promise<LoginResult | null> {
  try {
    const res = await fetch('/api/auth/session', { method: 'GET', credentials: 'include' });
    const raw: unknown = await res.json().catch(() => null);

    if (!isObject(raw)) return null;
    const o = raw as Record<string, unknown>;
    // 응답 래핑 해제
    const payload =
      (pickObj(o, 'result') as Record<string, unknown> | undefined) ??
      (pickObj(o, 'data') as Record<string, unknown> | undefined) ??
      (isObject(o) ? (o as Record<string, unknown>) : undefined);

    const userId = pickUserId(payload ?? o);
    if (userId == null) return null;

    const name = pickStr(payload, 'name', 'NAME') ?? null;
    const email = pickStr(payload, 'email', 'EMAIL') ?? null;

    return { userId, name, email };
  } catch {
    return null;
  }
}
