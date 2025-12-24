// env.d.ts
declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_API_BASE?: string;
        NEXT_PUBLIC_TOSS_CLIENT_KEY?: string;
        NEXT_PUBLIC_GRP_CD?: string;
        NEXT_PUBLIC_USE_ENVELOPE?: 'true' | 'false';
        NEXT_PUBLIC_FAKE_OWNER_ID?: string;
        NEXT_PUBLIC_STATIC_EXPORT?: 'true' | 'false';

        // iron-session 관련이 있다면 여기에 구체화
        AUTH_COOKIE_NAME?: string;
        AUTH_COOKIE_PASSWORD?: string;
        AUTH_COOKIE_TTL_DAYS?: string;
    }
}