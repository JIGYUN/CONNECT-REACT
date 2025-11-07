import { postJson } from '@/shared/core/apiClient';

/* ───────────────────────── 공통 타입 ───────────────────────── */
export type LoginInput = {
    email: string;
    password: string;
    /** 로그인 요청 시 함께 보내 DB 업데이트 트리거 */
    fcmToken?: string | null;
    platformInfo?: string | null;
};

export type LoginResult = {
    userId: number;
    name: string | null;
    email: string;
};

// 토큰 업서트 바디
export type SetUserFcmTokenVars = {
    userId: number;
    /** null -> 서버에서 TB_USER.FCM_TOKEN을 NULL로 클리어 */
    fcmToken: string | null;
    /** 선택 메타(서버에서 저장 원할 때만 사용) */
    platformInfo?: string | null;
};

/* ───────────────────────── 신규: 회원가입/중복체크 타입 ───────────────────────── */
export type SignupInput = {
    email: string;
    userNm: string;
    password: string;
    /** 선택 */
    telno?: string | null;
    /** 기본 'U' (JSP와 동일) */
    authType?: string | null;
};

export type DuplicateEmailCheckResult = {
    exists: boolean;
    count: number;
};

/* ─────────────────────── 안전 유틸(unknown 가드) ─────────────────────── */
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
function pickBool(o: Record<string, unknown> | undefined, ...keys: string[]): boolean | null {
    if (!o) return null;
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
            const t = v.toLowerCase().trim();
            if (t === 'true') return true;
            if (t === 'false') return false;
            if (t === '1') return true;
            if (t === '0') return false;
        }
    }
    return null;
}
/** undefined 키는 전송에서 제거(exactOptionalPropertyTypes 대응) */
function cleanObj<T extends Record<string, unknown>>(o: T): Partial<T> {
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
        const v = o[k];
        if (v !== undefined) r[k] = v;
    }
    return r as Partial<T>;
}

/* ───────────────────────── 로그인 ───────────────────────── */
export async function apiLogin(input: LoginInput): Promise<LoginResult> {
    // ⚠️ undefined는 전송하지 않음, 값이 없으면 null 또는 키 생략
    const body = cleanObj({
        email: input.email,
        password: input.password,
        fcmToken: input.fcmToken ?? null,
        platformInfo: input.platformInfo ?? null,
    });

    const data = await postJson<unknown>('/api/auth/selectLogin', body);

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
        /* 서버에 없으면 무시 */
    }
}

/* ───────────────────────(참고) 기존 토큰 업서트/클리어 ─────────────────────── */
export async function setUserFcmToken(vars: SetUserFcmTokenVars): Promise<void> {
    const body = cleanObj({
        userId: vars.userId,
        fcmToken: vars.fcmToken,
        platformInfo: vars.platformInfo ?? null,
    });
    await postJson<unknown>('/api/user/updateFcmToken', body);
}
export async function clearUserFcmToken(userId: number): Promise<void> {
    await setUserFcmToken({ userId, fcmToken: null });
}

/* ───────────────────────── 신규: 이메일 중복체크 ─────────────────────────
   - 요청: POST /api/auth/duplicateId { email }
   - 응답 예시: { result: { cnt: 0 } } 또는 유사 구조
────────────────────────── */
export async function apiCheckEmailDuplicate(email: string): Promise<DuplicateEmailCheckResult> {
    const body = cleanObj({ email });

    const data = await postJson<unknown>('/api/auth/duplicateId', body);
    if (!isObject(data)) return { exists: false, count: 0 };

    const all = data as Record<string, unknown>;
    const result = pickObj(all, 'result') ?? all;
    const cnt = pickNum(result, 'cnt', 'COUNT', 'count') ?? 0;

    return { exists: cnt > 0, count: cnt };
}

/* ───────────────────────── 신규: 회원가입 ─────────────────────────
   - 요청: POST /api/auth/insertJoin
   - 바디: { email, userNm, password, telno?, authType? } (undefined 키 제거)
   - 응답: { ok:true } 또는 200 + payload (유연하게 수용)
────────────────────────── */
export async function apiSignup(vars: SignupInput): Promise<void> {
    const body = cleanObj({
        email: vars.email,
        userNm: vars.userNm,
        telno: vars.telno ?? null,
        password: vars.password,
        authType: vars.authType ?? 'U',
    });

    const data = await postJson<unknown>('/api/auth/insertJoin', body);

    // 응답 형식이 다양한 경우를 흡수: ok 플래그가 false일 때만 에러
    if (isObject(data)) {
        const all = data as Record<string, unknown>;
        const okTop = pickBool(all, 'ok');
        const okNest = pickBool(pickObj(all, 'result'), 'ok');
        if (okTop === false || okNest === false) throw new Error('signup failed');
    }
    // 2xx면 성공으로 간주(에러는 postJson에서 throw)
}
