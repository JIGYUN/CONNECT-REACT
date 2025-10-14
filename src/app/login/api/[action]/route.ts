/* filepath: src/app/login/api/[action]/route.ts */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, setServerSession, clearServerSession } from '@/shared/core/auth/session';

type AnyObj = Record<string, any>;

function json(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function safeParseJSON(res: Response) {
  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  try { return { ok: res.ok, msg: await res.text() }; } catch { return null; }
}

/** 키 여러 개를 대소문자 가리지 않고 조회 */
function pick(o: AnyObj, ...keys: string[]) {
  for (const k of keys) {
    if (k in o) return o[k];
    const lower = k.toLowerCase();
    for (const kk of Object.keys(o)) if (kk.toLowerCase() === lower) return o[kk];
  }
  return undefined;
}

function isPlainObject(x: any) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

/** 재귀적으로 EMAIL + USER_ID 가 있는 객체를 찾는다 */
function findUserLike(node: any): AnyObj | null {
  if (!node) return null;

  // 배열이면 각 요소 탐색
  if (Array.isArray(node)) {
    for (const it of node) {
      const f = findUserLike(it);
      if (f) return f;
    }
    return null;
  }

  // 객체면 자신 검사 + 하위 키 검사
  if (isPlainObject(node)) {
    const email = pick(node, 'EMAIL', 'email');
    const uid   = pick(node, 'USER_ID', 'userId', 'id', 'USERIDX', 'userIdx');

    if (email != null && uid != null) return node as AnyObj;

    // 흔한 래핑 키들 순회
    const nests = ['result', 'data', 'user', 'payload', 'row', 'rows', 'list', 'content', 'items'];
    for (const key of nests) {
      const next = node[key];
      if (next != null) {
        const f = findUserLike(next);
        if (f) return f;
      }
    }

    // 아무 키나 재귀 (마지막 수단)
    for (const v of Object.values(node)) {
      if (isPlainObject(v) || Array.isArray(v)) {
        const f = findUserLike(v);
        if (f) return f;
      }
    }
  }
  return null;
}

/** 최종 세션용 표준화 */
function normalizeUser(userLike: AnyObj) {
  const userId  = pick(userLike, 'USER_ID', 'userId', 'id', 'USERIDX', 'userIdx');
  const email   = pick(userLike, 'EMAIL', 'email');
  const name    = pick(userLike, 'USER_NM', 'userNm', 'name');
  const auth    = pick(userLike, 'AUTH_TYPE', 'authType') ?? 'LOCAL';

  if (userId == null || email == null) return null;

  return {
    userId: Number(userId),
    email: String(email),
    name: name ?? null,
    authType: auth ?? 'LOCAL',
  };
}

async function callBackendLogin({ email, passwordHash }: { email: string; passwordHash: string }) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  const url = `${base}/api/auth/selectLogin`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // ✅ 서버가 해시하므로 평문 그대로, 키 이름은 passwordHash
    body: JSON.stringify({ email, passwordHash }),
  });

  const payload = await safeParseJSON(res);
  if (!res.ok) {
    const msg = (payload as any)?.msg || 'login failed';
    return { ok: false as const, msg };
  }

  const rawUser = findUserLike(payload);
  const user = rawUser ? normalizeUser(rawUser) : null;
  if (!user) return { ok: false as const, msg: 'invalid credentials' };

  return { ok: true as const, user };
}

async function handle(req: NextRequest, action: string) {
  if (action === 'login') {
    let email = '', passwordHash = '';
    try {
      const body = await req.json();
      email = String(body?.email || '').trim();
      passwordHash = String(body?.passwordHash || '').trim();
    } catch {
      return json({ ok: false, msg: 'invalid payload' }, 400);
    }
    if (!email || !passwordHash) return json({ ok: false, msg: 'email and password are required' }, 400);

    const backend = await callBackendLogin({ email, passwordHash });
    if (!backend.ok) return json({ ok: false, msg: backend.msg }, 401);

    await setServerSession({
      userId: backend.user.userId,
      email: backend.user.email,
      name: backend.user.name,
      authType: backend.user.authType,
      loggedAt: Date.now(),
    });

    return json({ ok: true, user: backend.user }, 200);
  }

  if (action === 'logout') {
    await clearServerSession();
    return json({ ok: true }, 200);
  }

  if (action === 'me') {
    const s = await getServerSession();
    if (!s) return json({ ok: false }, 401);
    return json({ ok: true, user: s }, 200);
  }

  return json({ ok: false, msg: 'unknown action' }, 404);
}

/* Next 15: params 는 Promise */
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handle(req, action);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handle(req, action);
}