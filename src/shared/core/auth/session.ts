/* filepath: src/shared/core/auth/session.ts */
import { cookies } from 'next/headers';

const COOKIE_NAME = 'connect_session';
const MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = {
  userId: number;
  email: string;
  name?: string | null;
  authType?: string;
  loggedAt?: number;
};

export async function getServerSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export async function setServerSession(user: SessionUser) {
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: JSON.stringify(user),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

export async function clearServerSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}