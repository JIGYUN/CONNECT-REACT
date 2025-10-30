// filepath: src/shared/core/auth/clientSession.ts

// ─────────────────────────────────────────────
// 클라이언트 전용 세션 관리 유틸 (Next 서버 기능 금지)
// ─────────────────────────────────────────────

export type ClientSession = {
    userId: number;
    email: string;
    name: string | null;
    loggedAt: number;
};

// 쿠키 이름 고정
const COOKIE = 'connect_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

// ─────────────────────────────────────────────
// 내부 헬퍼: 쿠키 원본 문자열 읽기
// ─────────────────────────────────────────────
function getCookieValueRaw(name: string): string | null {
    if (typeof document === 'undefined') return null;

    // name 안의 특수문자 이스케이프
    const safeName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

    const match = document.cookie.match(
        new RegExp('(?:^|;\\s*)' + safeName + '=([^;]*)')
    );

    return match ? match[1] ?? null : null;
}

// ─────────────────────────────────────────────
// 내부 헬퍼: 안전하게 number | null 추출
// ─────────────────────────────────────────────
function pickNumber(o: Record<string, unknown>, key: string): number | null {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

// ─────────────────────────────────────────────
// 내부 헬퍼: 안전하게 string | null 추출
// (undefined는 절대 그대로 올리지 않는다)
// ─────────────────────────────────────────────
function pickString(o: Record<string, unknown>, key: string): string | null {
    const v = o[key];
    return typeof v === 'string' ? v : null;
}

// ─────────────────────────────────────────────
// 세션 읽기
// cookie -> decodeURIComponent -> JSON.parse
// → 안전 가드 → ClientSession | null
// ─────────────────────────────────────────────
export function getClientSession(): ClientSession | null {
    const raw = getCookieValueRaw(COOKIE);
    if (!raw) return null;

    try {
        const decoded = decodeURIComponent(raw);

        // JSON.parse 결과를 unknown으로 받고 안전하게 좁힌다
        const parsedUnknown: unknown = JSON.parse(decoded);

        if (typeof parsedUnknown !== 'object' || parsedUnknown === null) {
            return null;
        }

        const parsed = parsedUnknown as Record<string, unknown>;

        // 필드 개별 추출 (브래킷 접근만 사용)
        const userIdVal: number | null = pickNumber(parsed, 'userId');
        const emailVal: string | null = pickString(parsed, 'email');
        const nameVal: string | null = pickString(parsed, 'name');
        const loggedAtVal: number | null = pickNumber(parsed, 'loggedAt');

        // 필수 조건: userId, email 은 반드시 있어야 "로그인된 세션"으로 인정
        // userId는 0 이상 양수만 유효하게 쓸 거라면 (>0)을 걸어도 된다.
        // 여기서는 "정상적인 숫자 존재"까지만 본다.
        if (userIdVal === null || emailVal === null) {
            return null;
        }

        const finalLoggedAt: number =
            loggedAtVal !== null ? loggedAtVal : Date.now();

        const session: ClientSession = {
            userId: userIdVal,
            email: emailVal,
            name: nameVal,
            loggedAt: finalLoggedAt,
        };

        return session;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// 세션 쓰기 (로그인 성공 시 호출)
// httpOnly를 여기서 줄 수는 없다. 이건 클라이언트 쿠키.
// Secure / SameSite=Lax / Max-Age 등만 세팅.
// ─────────────────────────────────────────────
export function setClientSession(s: ClientSession): void {
    // s 자체는 우리가 만든 안전 타입이라 바로 stringify해도 된다.
    const encoded = encodeURIComponent(JSON.stringify(s));

    document.cookie =
        `${COOKIE}=${encoded};` +
        ` Path=/;` +
        ` Max-Age=${MAX_AGE_SEC};` +
        ` SameSite=Lax;` +
        ` Secure`;
}

// ─────────────────────────────────────────────
// 세션 삭제 (로그아웃 시 호출)
// ─────────────────────────────────────────────
export function clearClientSession(): void {
    document.cookie =
        `${COOKIE}=;` +
        ` Path=/;` +
        ` Max-Age=0;` +
        ` SameSite=Lax;` +
        ` Secure`;
}
