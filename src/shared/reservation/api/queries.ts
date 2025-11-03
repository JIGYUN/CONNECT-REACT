// filepath: src/shared/reservation/api/queries.ts
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { postJson } from '@/shared/core/apiClient';
import type { ReservationEntry, ReservationUpsertInput } from '@/shared/reservation/types';
import { adaptInReservation } from '@/shared/reservation/adapters';

/* ───────────────────────────── common ───────────────────────────── */

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const normGrp   = (g?: string | null) => (g && g.trim() ? g : null);
const normOwner = (o?: number | null) => (typeof o === 'number' && Number.isFinite(o) ? o : null);

/** unwrap 배열/리스트 */
function arrFrom(v: unknown): Record<string, unknown>[] {
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    if (!isRec(v)) return [];
    if (Array.isArray(v['list']))   return v['list'] as Record<string, unknown>[];
    if (Array.isArray(v['rows']))   return v['rows'] as Record<string, unknown>[];
    if (Array.isArray(v['result'])) return v['result'] as Record<string, unknown>[];
    const r = v['result'];
    if (isRec(r) && Array.isArray(r['list'])) return r['list'] as Record<string, unknown>[];
    if (isRec(r) && Array.isArray(r['rows'])) return r['rows'] as Record<string, unknown>[];
    return [];
}

/** undefined 키 제거( exactOptionalPropertyTypes 대응 ) */
function cleanObj<T extends Record<string, unknown>>(o: T): T {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o) as (keyof T)[]) {
        const v = o[k];
        if (v !== undefined) out[k as string] = v as unknown;
    }
    return out as T;
}

/* ───────────────────────────── API endpoints ───────────────────────────── */

const API = {
    // 단건(에디터용)
    selectByDate: '/api/rsv/reservation/selectReservationByDate',
    upsert:       '/api/rsv/reservation/upsertReservation',

    // 목록/행위(목록형 페이지용)
    selectListByDate: '/api/rsv/reservation/selectReservationListByDate',
    insert:           '/api/rsv/reservation/insertReservation',
    toggleStatus:     '/api/rsv/reservation/updateReservationStatus', 
    delete:           '/api/rsv/reservation/deleteReservation',
};

/* ───────────────────────────── keys ───────────────────────────── */

function keyReservationByDate(diaryDt: string, grpCd?: string | null, ownerId?: number | null): QueryKey {
    return ['reservation/byDate', diaryDt, normGrp(grpCd), normOwner(ownerId)];
}
function keyReservationListByDate(resvDate: string, grpCd?: string | null, ownerId?: number | null): QueryKey {
    return ['reservation/listByDate', resvDate, normGrp(grpCd), normOwner(ownerId)];
}

/* ───────────────────────────── 단건(에디터 페이지) ───────────────────────────── */

async function getByDate(diaryDt: string, grpCd?: string | null, ownerId?: number | null): Promise<ReservationEntry | null> {
    const payload = { diaryDt, grpCd: normGrp(grpCd), ownerId: normOwner(ownerId) };
    const data = await postJson<unknown>(API.selectByDate, payload);

    // result/data/item 언랩 → 첫 행
    let cur: unknown = data;
    for (let i = 0; i < 5; i++) {
        if (Array.isArray(cur)) {
            return cur.length ? adaptInReservation(cur[0]) : null;
        }
        if (isRec(cur)) {
            if (Array.isArray(cur['list'])) return (cur['list'] as unknown[]).length ? adaptInReservation((cur['list'] as unknown[])[0]) : null;
            if (Array.isArray(cur['rows'])) return (cur['rows'] as unknown[]).length ? adaptInReservation((cur['rows'] as unknown[])[0]) : null;
            const next = (cur['result'] ?? cur['data'] ?? cur['item']) as unknown;
            if (next && typeof next === 'object') { cur = next; continue; }
        }
        break;
    }
    return isRec(cur) ? adaptInReservation(cur) : null;
}

export function useReservationByDate(p: { diaryDt: string; grpCd?: string | null; ownerId?: number | null }) {
    const diaryDt = p.diaryDt;
    const grpCd   = normGrp(p.grpCd ?? null);
    const ownerId = normOwner(p.ownerId ?? null);

    return useQuery<ReservationEntry | null, Error>({
        queryKey: keyReservationByDate(diaryDt, grpCd, ownerId),
        queryFn: () => getByDate(diaryDt, grpCd, ownerId),
        enabled: !!diaryDt, // ownerId 없어도 조회 허용
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 2000,
    });
}

export function useUpsertReservation(ctx: { grpCd?: string | null; ownerId?: number | null }) {
    const qc = useQueryClient();
    const grpCd   = normGrp(ctx.grpCd ?? null);
    const ownerId = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, ReservationUpsertInput>({
        mutationFn: async (input) => {
            // undefined는 아예 키를 만들지 않는다(조건부 스프레드)
            const body = cleanObj({
                diaryDt: input.diaryDt,
                content: input.content,
                ...( (input.grpCd ?? grpCd) ? { grpCd: (input.grpCd ?? grpCd)! } : {} ),
                ...( ((input.ownerId ?? ownerId) !== null && (input.ownerId ?? ownerId) !== undefined)
                    ? { ownerId: (input.ownerId ?? ownerId)! }
                    : {} ),
            });
            await postJson<unknown>(API.upsert, body);
        },
        onSuccess: (_d, v) => {
            // diaryDt 기준으로 단건 캐시 무효화
            const keyDate = (v as Record<string, unknown>)['diaryDt'];
            const keyStr = typeof keyDate === 'string' ? keyDate.slice(0, 10) : '';
            const key = keyStr ? keyReservationByDate(keyStr, grpCd, ownerId) : ['reservation/byDate'];
            const qc_ = qc;
            qc_.invalidateQueries({ queryKey: key });
        },
    });
}

/* ───────────────────────────── 목록 페이지용(리스트/삽입/토글/삭제) ───────────────────────────── */

export async function getReservationListByDate(resvDate: string, grpCd?: string | null, ownerId?: number | null): Promise<ReservationEntry[]> {
    const payload = { resvDate, grpCd: normGrp(grpCd), ownerId: normOwner(ownerId) };
    const data = await postJson<unknown>(API.selectListByDate, payload);
    return arrFrom(data).map(adaptInReservation);
}

export function useReservationListByDate(p: { resvDate: string; grpCd?: string | null; ownerId?: number | null }) {
    const resvDate = p.resvDate;
    const grpCd    = normGrp(p.grpCd ?? null);
    const ownerId  = normOwner(p.ownerId ?? null);

    return useQuery<ReservationEntry[], Error>({
        queryKey: keyReservationListByDate(resvDate, grpCd, ownerId),
        queryFn: () => getReservationListByDate(resvDate, grpCd, ownerId),
        enabled: !!resvDate,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 2000,
    });
}

/** 빠른 등록 입력값 */
export type ReservationInsertVars = Readonly<{
    title: string;
    resvStartDt: string; // "YYYY-MM-DDTHH:mm"
    resvEndDt: string;   // "
    grpCd?: string;
    ownerId?: number | null;
    resourceNm?: string | null;
    capacityCnt?: number | null;
    statusCd?: string | null; // 기본 'SCHEDULED'
}>;

export function useInsertReservation(ctx: { grpCd?: string | null; ownerId?: number | null }) {
    const qc = useQueryClient();
    const grpCd   = normGrp(ctx.grpCd ?? null);
    const ownerId = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, ReservationInsertVars>({
        mutationFn: async (v) => {
            const body = cleanObj({
                title: v.title,
                resvStartDt: v.resvStartDt,
                resvEndDt: v.resvEndDt,
                ...( (v.grpCd ?? grpCd) ? { grpCd: (v.grpCd ?? grpCd)! } : {} ),
                ...( ((v.ownerId ?? ownerId) !== null && (v.ownerId ?? ownerId) !== undefined)
                    ? { ownerId: (v.ownerId ?? ownerId)! }
                    : {} ),
                ...(v.resourceNm !== undefined ? { resourceNm: v.resourceNm } : {}),
                ...(v.capacityCnt !== undefined ? { capacityCnt: v.capacityCnt } : {}),
                statusCd: v.statusCd ?? 'SCHEDULED',
            });
            await postJson<unknown>(API.insert, body);
        },
        onSuccess: () => {
            // 목록은 호출부에서 정확한 날짜 키로 invalidate 하므로 여기서는 광범위 키 무효화
            qc.invalidateQueries({ queryKey: ['reservation/listByDate'] });
        },
    });
}

export type ReservationToggleVars = Readonly<{ reservationId: number; statusCd: string }>;

export function useToggleReservationStatus(ctx: { resvDate: string; grpCd?: string | null; ownerId?: number | null }) {
    const qc = useQueryClient();
    const resvDate = ctx.resvDate;
    const grpCd    = normGrp(ctx.grpCd ?? null);
    const ownerId  = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, ReservationToggleVars>({
        mutationFn: async (v) => {
            const body = cleanObj({ reservationId: v.reservationId, statusCd: v.statusCd });
            await postJson<unknown>(API.toggleStatus, body);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keyReservationListByDate(resvDate, grpCd, ownerId) });
        },
    });
}

export type ReservationDeleteVars = Readonly<{ reservationId: number }>;

export function useDeleteReservation(ctx: { resvDate: string; grpCd?: string | null; ownerId?: number | null }) {
    const qc = useQueryClient();
    const resvDate = ctx.resvDate;
    const grpCd    = normGrp(ctx.grpCd ?? null);
    const ownerId  = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, ReservationDeleteVars>({
        mutationFn: async (v) => {
            const body = cleanObj({ reservationId: v.reservationId });
            await postJson<unknown>(API.delete, body);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keyReservationListByDate(resvDate, grpCd, ownerId) });
        },
    });
}
