// 4-space indent
export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? "http://localhost:8080";

export const DEFAULT_GRP_CD =
    process.env.NEXT_PUBLIC_GRP_CD ?? "sikyung";

// 서버가 { ok, result } 래핑을 쓰지 않는 경우를 대비해 스위치
export const USE_ENVELOPE =
    (process.env.NEXT_PUBLIC_USE_ENVELOPE ?? "true") === "true";