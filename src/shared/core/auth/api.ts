import { postJson } from '@/shared/core/apiClient';

// 로그인 입력 / 결과 타입
export type LoginInput = { email: string; password: string };
export type LoginResult = {
    userId: number;
    name: string | null;
    email: string;
};

// 내부 헬퍼들
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

/**
 * 백엔드(Spring) 로그인 API 호출.
 *  - /api/auth/selectLogin → rewrite → Spring 서버
 *  - 반환 JSON 구조는 우리 백엔드 마음대로일 수 있어서 여러 케이스를 흡수.
 */
export async function apiLogin(input: LoginInput): Promise<LoginResult> {
    const data = await postJson<unknown>('/api/auth/selectLogin', input);

    // 다양한 wrapping(result/data/user)에서 userId/email/name 뽑기
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

    return {
        userId,
        email,
        name,
    };
}

/**
 * optional: 서버 세션 정리 API(만약 백엔드에서 세션/로그 기록 지우고 싶으면 호출)
 * 백엔드에 /api/auth/logout 같은 게 있다면 여기서 POST 해도 된다.
 * UI 동작은 이거 없이도 된다.
 */
export async function apiServerLogout(): Promise<void> {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
    } catch {
        // 서버 없으면 그냥 무시
    }
}