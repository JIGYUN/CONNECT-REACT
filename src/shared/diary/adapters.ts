// filepath: src/shared/diary/adapters.ts
import type { DiaryEntry } from '@/shared/diary/types';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const pickStr = (o: Record<string, unknown>, ...keys: string[]): string | null => {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return null;
};

const pickNum = (o: Record<string, unknown>, ...keys: string[]): number | null => {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const n = typeof v === 'string' ? Number(v) : NaN;
        if (Number.isFinite(n)) return n;
    }
    return null;
};

/** 서버 응답 한 레코드를 표준 DiaryEntry로 어댑트 */
export function adaptInDiary(row: unknown): DiaryEntry {
    // result/data/item 래핑을 최대 5단계까지 벗겨낸다.
    let cur: unknown = row;
    for (let i = 0; i < 5; i++) {
        if (!isRec(cur)) break;
        const next = (isRec(cur['result']) && cur['result'])
            || (isRec(cur['data']) && cur['data'])
            || (isRec(cur['item']) && cur['item']);
        if (next) { cur = next; continue; }
        break;
    }
    const o = isRec(cur) ? cur : {};

    const id      = pickNum(o, 'id', 'ID', 'diaryId', 'DIARY_ID');
    const ymd     = pickStr(o, 'ymd', 'YMD', 'diaryDt', 'DIARY_DT') ?? '';
    const ownerId = pickNum(o, 'ownerId', 'OWNER_ID');
    const title   = pickStr(o, 'title', 'TITLE');
    const body    = pickStr(o, 'body', 'BODY');
    const content = pickStr(o, 'content', 'CONTENT');

    return {
        id: id ?? null,
        ymd,
        title,
        body: body ?? content,
        content,
        ownerId: ownerId ?? null,
    };
}

/** 표준 → 서버 아웃바운드(대문자 키 호환) */
export function adaptOutDiary(input: DiaryEntry): Record<string, unknown> {
    return {
        ID: input.id ?? null,
        YMD: input.ymd,
        TITLE: input.title ?? null,
        BODY: input.body ?? input.content ?? null,
        OWNER_ID: input.ownerId ?? null,
    };
}