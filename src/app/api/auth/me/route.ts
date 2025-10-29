// filepath: src/app/api/auth/me/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
export const runtime = 'edge';

type SessionPayload = { userId: number; email: string; name?: string | null };

function isSessionPayload(v: unknown): v is SessionPayload {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o['userId'] === 'number' && typeof o['email'] === 'string';
}

function parseSession(raw?: string): SessionPayload | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(decodeURIComponent(raw));
    if (!isSessionPayload(v)) return null;

    // v는 SessionPayload로 좁혀졌지만, index signature 규칙을 한 번 더 만족시키고 싶을 때:
    const o = v as Record<string, unknown>;
    return {
      userId: o['userId'] as number,
      email: o['email'] as string,
      name: (o['name'] as string | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const store = await cookies();
  const payload = parseSession(store.get('connect_session')?.value);
  return NextResponse.json({ ok: true, result: payload });
}