import { NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: 'connect_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: 0,
  });
  return res;
}