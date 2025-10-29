// filepath: src/shared/diary/api/queries.ts
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { postJson } from '@/shared/core/apiClient';
import type { DiaryEntry, DiaryUpsertInput } from '@/shared/diary/types';
import { adaptInDiary } from '@/shared/diary/adapters';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const normGrp = (g?: string | null) => (g && g.trim() ? g : null);
const normOwner = (o?: number | null) => (typeof o === 'number' && Number.isFinite(o) ? o : null);

function keyByDate(diaryDt: string, grpCd?: string | null, ownerId?: number | null): QueryKey {
    return ['diary/byDate', diaryDt, normGrp(grpCd), normOwner(ownerId)];
}

/** result/rows/list/단일객체 어떤 형태든 첫 레코드를 뽑아 DiaryEntry로 변환 */
function extractDiary(v: unknown): DiaryEntry | null {
    const unwrapList = (x: unknown): unknown => {
        if (Array.isArray(x)) return x;
        if (isRec(x) && Array.isArray(x['result'])) return x['result'];
        if (isRec(x) && Array.isArray(x['rows']))   return x['rows'];
        if (isRec(x) && Array.isArray(x['list']))   return x['list'];
        return x;
    };

    let cur: unknown = v;
    for (let i = 0; i < 5; i++) {
        const list = unwrapList(cur);
        if (Array.isArray(list)) return list.length ? adaptInDiary(list[0]) : null;
        if (isRec(cur) && (isRec(cur['result']) || isRec(cur['data']) || isRec(cur['item']))) {
            cur = (cur['result'] as unknown) || (cur['data'] as unknown) || (cur['item'] as unknown);
            continue;
        }
        break;
    }
    return isRec(cur) ? adaptInDiary(cur) : null;
}

const API = {
    selectByDate: '/api/tsk/diary/selectDiaryByDate',
    upsert:       '/api/tsk/diary/upsertDiary',
};

async function getDiaryByDate(diaryDt: string, grpCd?: string | null, ownerId?: number | null): Promise<DiaryEntry | null> {
    const payload = { diaryDt, grpCd: normGrp(grpCd), ownerId: normOwner(ownerId) };
    const data = await postJson<unknown>(API.selectByDate, payload);
    return extractDiary(data);
}

export function useDiaryByDate(p: { diaryDt: string; grpCd?: string | null; ownerId?: number | null }) {
    const diaryDt = p.diaryDt;
    const grpCd   = normGrp(p.grpCd ?? null);
    const ownerId = normOwner(p.ownerId ?? null);

    return useQuery<DiaryEntry | null, Error>({
        queryKey: keyByDate(diaryDt, grpCd, ownerId),
        queryFn: () => getDiaryByDate(diaryDt, grpCd, ownerId),
        enabled: !!diaryDt && ownerId !== null,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 2_000,
    });
}

export function useUpsertDiary(ctx: { grpCd?: string | null; ownerId?: number | null }) {
    const qc = useQueryClient();
    const grpCd   = normGrp(ctx.grpCd ?? null);
    const ownerId = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, DiaryUpsertInput>({
        mutationFn: async (input) => {
            const body: DiaryUpsertInput = {
                diaryDt: input.diaryDt,
                content: input.content,
                grpCd:   input.grpCd ?? grpCd ?? null,
                ownerId: normOwner(input.ownerId ?? ownerId),
            };
            await postJson<unknown>(API.upsert, body);
        },
        onSuccess: (_d, v) => {
            const keyDate = (v.diaryDt ?? '').slice(0, 10);
            if (keyDate) qc.invalidateQueries({ queryKey: keyByDate(keyDate, grpCd, ownerId) });
            else qc.invalidateQueries({ queryKey: ['diary/byDate'] });
        },
    });
}