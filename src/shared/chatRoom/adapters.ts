// filepath: src/shared/chatRoom/adapters.ts
import type { ChatRoomEntry } from '@/shared/chatRoom/types';

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
        if (next) {
            cur = next;
            continue;
        }
        break;
    }
    return isRec(cur) ? cur : {};
}

/** 서버 → 프런트 표준화 */
export function adaptInChatRoom(row: unknown): ChatRoomEntry {
    const o = unwrapRow(row);
    const idField = pickNum(o, ['ROOM_ID', 'roomId', 'id', 'ID']);
    const grpCdField = pickStr(o, ['GRP_CD', 'grpCd']);
    const ownerIdField = pickNum(o, ['OWNER_ID', 'ownerId']);
    const roomNmField = pickStr(o, ['ROOM_NM', 'roomNm']);
    const roomTypeField = pickStr(o, ['ROOM_TYPE', 'roomType']);
    const roomDescField = pickStr(o, ['ROOM_DESC', 'roomDesc']);
    const lastMsgContentField = pickStr(o, ['LAST_MSG_CONTENT', 'lastMsgContent']);
    const lastMsgSentDtField = pickStr(o, ['LAST_MSG_SENT_DT', 'lastMsgSentDt']);
    const useAtField = pickStr(o, ['USE_AT', 'useAt']);
    const createdDtField = pickStr(o, ['CREATED_DT', 'createdDt']);
    const createdByField = pickNum(o, ['CREATED_BY', 'createdBy']);
    const updatedDtField = pickStr(o, ['UPDATED_DT', 'updatedDt']);
    const updatedByField = pickNum(o, ['UPDATED_BY', 'updatedBy']);

    return {
        id: idField ?? null,
        grpCd: grpCdField ?? null,
        ownerId: ownerIdField ?? null,
        roomNm: roomNmField ?? null,
        roomType: roomTypeField ?? null,
        roomDesc: roomDescField ?? null,
        lastMsgContent: lastMsgContentField ?? null,
        lastMsgSentDt: lastMsgSentDtField ?? null,
        useAt: useAtField ?? null,
        createdDt: createdDtField ?? null,
        createdBy: createdByField ?? null,
        updatedDt: updatedDtField ?? null,
        updatedBy: updatedByField ?? null,
    };
}
