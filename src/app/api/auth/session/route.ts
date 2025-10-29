// filepath: src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

const COOKIE = 'connect_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7d

type SessionPayload = {
  userId: number;
  email: string;
  name?: string | null;
};

function isPayload(v: unknown): v is SessionPayload {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o['userId'] === 'number' && typeof o['email'] === 'string';
}

function parseCookie(raw?: string): SessionPayload | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(decodeURIComponent(raw));
    return isPayload(v) ? (v as SessionPayload) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const store = await cookies(); // ← edge: Promise 반환
  const payload = parseCookie(store.get(COOKIE)?.value);
  return NextResponse.json({ ok: true, result: payload });
}

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {}
  if (!isPayload(body)) {
    return NextResponse.json({ ok: false, msg: 'Bad payload' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: encodeURIComponent(JSON.stringify(body)),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: 0,
  });
  return res;
}
