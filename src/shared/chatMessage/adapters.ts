// filepath: src/shared/chatMessage/adapters.ts
import type { ChatMessageEntry } from '@/shared/chatMessage/types';

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
export function adaptInChatMessage(row: unknown): ChatMessageEntry {
    const o = unwrapRow(row);

    const idField = pickNum(o, ['MSG_ID', 'msgId', 'id', 'ID']);
    const roomIdField = pickNum(o, ['ROOM_ID', 'roomId']);
    const senderIdField = pickNum(o, ['SENDER_ID', 'senderId']);
    const senderNmField = pickStr(o, ['SENDER_NM', 'senderNm']);
    const contentField = pickStr(o, ['CONTENT', 'content']);
    const contentTypeField = pickStr(o, ['CONTENT_TYPE', 'contentType']);
    const sentDtField = pickStr(o, ['SENT_DT', 'sentDt']);
    const readCntField = pickNum(o, ['READ_CNT', 'readCnt']);
    const useAtField = pickStr(o, ['USE_AT', 'useAt']);
    const createdDtField = pickStr(o, ['CREATED_DT', 'createdDt']);
    const createdByField = pickNum(o, ['CREATED_BY', 'createdBy']);
    const updatedDtField = pickStr(o, ['UPDATED_DT', 'updatedDt']);
    const updatedByField = pickNum(o, ['UPDATED_BY', 'updatedBy']);

    return {
        id: idField ?? null,
        roomId: roomIdField ?? null,
        senderId: senderIdField ?? null,
        senderNm: senderNmField ?? null,
        content: contentField ?? null,
        contentType: contentTypeField ?? null,
        sentDt: sentDtField ?? null,
        readCnt: readCntField ?? null,
        useAt: useAtField ?? null,
        createdDt: createdDtField ?? null,
        createdBy: createdByField ?? null,
        updatedDt: updatedDtField ?? null,
        updatedBy: updatedByField ?? null,
    };
}

/** 프런트 → 서버 (업서트/전송용) */
export function adaptOutChatMessage(
    input: ChatMessageEntry,
): Record<string, unknown> {
    return {
        MSG_ID: input.id ?? null,
        ROOM_ID: input.roomId ?? null,
        SENDER_ID: input.senderId ?? null,
        SENDER_NM: input.senderNm ?? null,
        CONTENT: input.content ?? null,
        CONTENT_TYPE: input.contentType ?? null,
        SENT_DT: input.sentDt ?? null,
        READ_CNT: input.readCnt ?? null,
        USE_AT: input.useAt ?? null,
        CREATED_DT: input.createdDt ?? null,
        CREATED_BY: input.createdBy ?? null,
        UPDATED_DT: input.updatedDt ?? null,
        UPDATED_BY: input.updatedBy ?? null,
    };
}
