// filepath: src/shared/types/common.ts
export type Id = number;
export type Ymd = string;           // 'YYYY-MM-DD'
export type IsoDateTime = string;   // ISO string

export type ApiEnvelope<T> = { ok: boolean; result: T; msg?: string };

export type ListResult<T> = {
    rows: T[];
    total?: number;
};

export type AnyRecord = Record<string, unknown>;

// --- Type Guards ---
export function isApiEnvelope(x: unknown): x is ApiEnvelope<unknown> {
    return typeof x === 'object' && x !== null && 'ok' in x && 'result' in x;
}
export function asNumber(v: unknown, d: number = 0): number {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : d;
}
export function asString(v: unknown, d = ''): string {
    return typeof v === 'string' ? v : d;
}
export function asBoolean(v: unknown, d = false): boolean {
    if (typeof v === 'boolean') return v;
    if (v === 'Y' || v === 'y' || v === 1 || v === '1') return true;
    if (v === 'N' || v === 'n' || v === 0 || v === '0') return false;
    return d;
}