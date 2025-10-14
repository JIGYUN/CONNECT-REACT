type ApiOk<T = any> = { ok: true; result?: T; msg?: string };
type ApiFail = { ok: false; msg?: string };
export type ApiRes<T = any> = ApiOk<T> | ApiFail;

export async function apiLogin(email: string, password: string): Promise<ApiRes> {
  // ✅ passwordHash 키로 전송 (값은 평문, 해시는 백엔드에서 처리)
  const r = await fetch('/login/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordHash: password }),
  });
  return r.json();
}

export async function apiLogout(): Promise<ApiRes> {
  const r = await fetch('/login/api/logout', { method: 'POST' });
  return r.json();
}

export async function apiMe(): Promise<ApiRes> {
  const r = await fetch('/login/api/me', { cache: 'no-store' });
  return r.json();
}