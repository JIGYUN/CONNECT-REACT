// filepath: src/app/api/auth/session/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // ✅ Cloudflare Pages 요구사항

const COOKIE_NAME = 'connect_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function POST(req: Request) {
  let body: any = null;
  try { body = await req.json(); } catch {}
  const { userId, email, name = null } = body ?? {};
  if (typeof userId !== 'number' || !email) {
    return json({ ok: false, msg: 'invalid payload(userId/email)' }, { status: 400 });
  }

  const value = encodeURIComponent(JSON.stringify({
    userId,
    email: String(email),
    name,
    authType: 'remote',
    loggedAt: Date.now(),
  }));

  const res = json({ ok: true, userId, email, name });
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,        // Pages는 HTTPS라 true 고정 추천
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: 0,           // 쿠키 제거
  });
  return res;
}