// filepath: src/shared/core/auth/session.ts
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

// --- 안전 직렬화/역직렬화 ---
function encodeCookie(obj: unknown): string {
    // JSON 그대로 저장(기본). 필요하면 base64url로 바꿔도 됨.
    return JSON.stringify(obj);
}
function tryJson<T>(s: string | null | undefined): T | null {
    if (!s) return null;
    try { return JSON.parse(s) as T; } catch { return null; }
}
function tryBase64Json<T>(s: string | null | undefined): T | null {
    if (!s) return null;
    try {
        const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
        const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
        return JSON.parse(json) as T;
    } catch { return null; }
}

export async function getServerSession(): Promise<SessionUser | null> {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    const parsed = tryJson<SessionUser>(raw) ?? tryBase64Json<SessionUser>(raw);
    if (!parsed || typeof parsed.userId !== 'number') return null;
    return parsed;
}

export async function setServerSession(user: SessionUser) {
    const store = await cookies();
    store.set({
        name: COOKIE_NAME,
        value: encodeCookie(user),
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