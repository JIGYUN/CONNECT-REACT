// filepath: src/shared/core/auth/actions.ts
'use server';

import { apiLogin } from '@/shared/core/auth/api';
import { setServerSession, clearServerSession } from '@/shared/core/auth/session';
import type { SessionUser } from '@/shared/core/auth/session';

type LoginArgs = { email: string; password: string };

export type LoginAndSetSessionResult =
  | { ok: true; userId: number; name: string | null }
  | { ok: false; msg: string };

export async function loginAndSetSession(
  { email, password }: LoginArgs,
): Promise<LoginAndSetSessionResult> {
  try {
    const login = await apiLogin({ email, password });

    const payload: SessionUser = {
      userId: login.userId,
      email,
      name: login.name ?? null,
      authType: 'remote',
      loggedAt: Date.now(),
    };

    await setServerSession(payload);
    return { ok: true, userId: login.userId, name: login.name ?? null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '로그인 실패';
    // 서버액션에서 throw 하지 않고 실패 결과를 반환 → Next의 “generic” 에러 메시지 차단
    return { ok: false, msg };
  }
}

export async function logoutAndClearSession(): Promise<{ ok: true }> {
  await clearServerSession();
  return { ok: true as const };
}