// filepath: src/shared/core/auth/clientSession.ts

// 클라이언트 전용(Next 서버 기능 금지)
import { postJson } from '@/shared/core/apiClient';

/* ─────────────────────────────────────────────
 * 타입
 * ──────────────────────────────────────────── */
export type ClientSession = {
    userId: number;
    email: string;
    name: string | null;
    loggedAt: number;
};

export type LoginInput = { email: string; password: string };
export type LoginResult = {
    userId: number;
    name: string | null;
    email: string;
};

/* ─────────────────────────────────────────────
 * 쿠키 설정
 * ──────────────────────────────────────────── */
const COOKIE = 'connect_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

/* ─────────────────────────────────────────────
 * 내부 헬퍼
 * ──────────────────────────────────────────── */
function getCookieValueRaw(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const safeName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + safeName + '=([^;]*)'));
    return match ? (match[1] ?? null) : null;
}

function pickNumber(o: Record<string, unknown>, key: string): number | null {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function pickString(o: Record<string, unknown>, key: string): string | null {
    const v = o[key];
    return typeof v === 'string' ? v : null;
}

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
function pickStr(o: Record<string, unknown> | undefined, ...keys: string[]): string | null {
    if (!o) return null;
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string') return v;
    }
    return null;
}

/* ─────────────────────────────────────────────
 * 세션 읽기
 * cookie -> decodeURIComponent -> JSON.parse
 * → 안전 가드 → ClientSession | null
 * ──────────────────────────────────────────── */
export function getClientSession(): ClientSession | null {
    const raw = getCookieValueRaw(COOKIE);
    if (!raw) return null;

    try {
        const decoded = decodeURIComponent(raw);
        const parsedUnknown: unknown = JSON.parse(decoded);
        if (typeof parsedUnknown !== 'object' || parsedUnknown === null) return null;

        const parsed = parsedUnknown as Record<string, unknown>;
        const userIdVal = pickNumber(parsed, 'userId');
        const emailVal = pickString(parsed, 'email');
        const nameVal = pickString(parsed, 'name');
        const loggedAtVal = pickNumber(parsed, 'loggedAt');

        if (userIdVal === null || emailVal === null) return null;

        const session: ClientSession = {
            userId: userIdVal,
            email: emailVal,
            name: nameVal,
            loggedAt: loggedAtVal !== null ? loggedAtVal : Date.now(),
        };
        return session;
    } catch {
        return null;
    }
}

/* ─────────────────────────────────────────────
 * 세션 쓰기/삭제
 *  - HTTPS에서만 Secure 플래그 부여(HTTP/IP에서는 제외)
 *  - SSR 안전 가드(document/location 존재 체크)
 * ──────────────────────────────────────────── */
export function setClientSession(s: ClientSession): void {
    if (typeof document === 'undefined') return;

    const encoded = encodeURIComponent(JSON.stringify(s));
    const attrs: string[] = ['Path=/', `Max-Age=${MAX_AGE_SEC}`, 'SameSite=Lax'];
    if (typeof location !== 'undefined' && location.protocol === 'https:') {
        attrs.push('Secure');
    }
    document.cookie = `${COOKIE}=${encoded}; ${attrs.join('; ')}`;
}

export function clearClientSession(): void {
    if (typeof document === 'undefined') return;

    const attrs: string[] = ['Path=/', 'Max-Age=0', 'SameSite=Lax'];
    if (typeof location !== 'undefined' && location.protocol === 'https:') {
        attrs.push('Secure');
    }
    document.cookie = `${COOKIE}=; ${attrs.join('; ')}`;
}

/* ─────────────────────────────────────────────
 * 로그인/로그아웃 API (클라이언트용)
 * ──────────────────────────────────────────── */
export async function apiLogin(input: LoginInput): Promise<LoginResult> {
    const data = await postJson<unknown>('/api/auth/selectLogin', input);
    if (!isObject(data)) throw new Error('Invalid login response');

    const all = data as Record<string, unknown>;
    const result = pickObj(all, 'result') ?? pickObj(all, 'data') ?? pickObj(all, 'user') ?? all;

    const userId =
        pickNum(result, 'userId', 'USER_ID', 'id', 'ID') ??
        pickNum(all, 'userId', 'USER_ID', 'id', 'ID');

    if (userId == null) throw new Error('Invalid login response(userId)');

    const email =
        pickStr(result, 'email', 'EMAIL') ??
        pickStr(all, 'email', 'EMAIL') ??
        input.email;

    const name =
        pickStr(result, 'name', 'NAME') ??
        pickStr(all, 'name', 'NAME') ??
        null;

    if (!email) throw new Error('Invalid login response(email)');

    return { userId, email, name };
}

export async function apiServerLogout(): Promise<void> {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
        // 서버에 로그아웃 엔드포인트가 없을 수 있으므로 무시
    }
}
