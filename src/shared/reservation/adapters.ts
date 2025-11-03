// filepath: src/shared/reservation/adapters.ts
import type { ReservationEntry } from '@/shared/reservation/types';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

function pickStr(o: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return null;
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
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

/** result/data/item 래핑을 최대 5단계 언랩 */
function unwrapRow(row: unknown): Record<string, unknown> {
    let cur: unknown = row;
    for (let i = 0; i < 5; i++) {
        if (!isRec(cur)) break;
        const next =
            (isRec(cur['result']) && cur['result']) ||
            (isRec(cur['data']) && cur['data']) ||
            (isRec(cur['item']) && cur['item']);
        if (next) { cur = next; continue; }
        break;
    }
    return isRec(cur) ? cur : {};
}

/** 서버 → 프런트 표준화 */
export function adaptInReservation(row: unknown): ReservationEntry {
    const o = unwrapRow(row);

    const idField              = pickNum(o, ['RESERVATION_ID', 'reservationId', 'id', 'ID']);
    const grpCdField           = pickStr(o, ['GRP_CD', 'grpCd']);
    const ownerIdField         = pickNum(o, ['OWNER_ID', 'ownerId']);
    const titleField           = pickStr(o, ['TITLE', 'title']);
    const contentField         = pickStr(o, ['CONTENT', 'content', 'body']);
    const resourceNmField      = pickStr(o, ['RESOURCE_NM', 'resourceNm']);
    const capacityCntField     = pickNum(o, ['CAPACITY_CNT', 'capacityCnt']);
    const resvStartDtField     = pickStr(o, ['RESV_START_DT', 'resvStartDt']);
    const resvEndDtField       = pickStr(o, ['RESV_END_DT', 'resvEndDt']);
    const statusCdField        = pickStr(o, ['STATUS_CD', 'statusCd']);
    const alertBeforeMinField  = pickNum(o, ['ALERT_BEFORE_MIN', 'alertBeforeMin']);
    const useAtField           = pickStr(o, ['USE_AT', 'useAt']);
    const createdDtField       = pickStr(o, ['CREATED_DT', 'createdDt']);
    const createdByField       = pickNum(o, ['CREATED_BY', 'createdBy']);
    const updatedDtField       = pickStr(o, ['UPDATED_DT', 'updatedDt']);
    const updatedByField       = pickNum(o, ['UPDATED_BY', 'updatedBy']);

    return {
        reservationId: idField ?? null,
        grpCd: grpCdField ?? null,
        ownerId: ownerIdField ?? null,
        title: titleField ?? null,
        content: contentField ?? null,
        resourceNm: resourceNmField ?? null,
        capacityCnt: capacityCntField ?? null,
        resvStartDt: resvStartDtField ?? null,
        resvEndDt: resvEndDtField ?? null,
        statusCd: statusCdField ?? null,
        alertBeforeMin: alertBeforeMinField ?? null,
        useAt: useAtField ?? null,
        createdDt: createdDtField ?? null,
        createdBy: createdByField ?? null,
        updatedDt: updatedDtField ?? null,
        updatedBy: updatedByField ?? null,
    };
}

/** 프런트 → 서버 (업서트/전송용) */
export function adaptOutReservation(input: ReservationEntry): Record<string, unknown> {
    return {
        RESERVATION_ID: input.reservationId ?? null,
        GRP_CD: input.grpCd ?? null,
        OWNER_ID: input.ownerId ?? null,
        TITLE: input.title ?? null,
        CONTENT: input.content ?? null,
        RESOURCE_NM: input.resourceNm ?? null,
        CAPACITY_CNT: input.capacityCnt ?? null,
        RESV_START_DT: input.resvStartDt ?? null,
        RESV_END_DT: input.resvEndDt ?? null,
        STATUS_CD: input.statusCd ?? null,
        ALERT_BEFORE_MIN: input.alertBeforeMin ?? null,
        USE_AT: input.useAt ?? null,
        CREATED_DT: input.createdDt ?? null,
        CREATED_BY: input.createdBy ?? null,
        UPDATED_DT: input.updatedDt ?? null,
        UPDATED_BY: input.updatedBy ?? null,
    };
}
