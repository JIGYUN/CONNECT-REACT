// filepath: src/shared/chatRoom/api/queries.ts
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { postJson } from '@/shared/core/apiClient';
import type { ChatRoomEntry, ChatRoomUpsertInput } from '@/shared/chatRoom/types';
import { adaptInChatRoom } from '@/shared/chatRoom/adapters';

const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const normGrp = (g?: string | null) => (g && g.trim() ? g : null);
const normOwner = (o?: number | null) =>
    typeof o === 'number' && Number.isFinite(o) ? o : null;

function keyChatRoomByDate(
    diaryDt: string,
    grpCd?: string | null,
    ownerId?: number | null,
): QueryKey {
    return ['chatRoom/byDate', diaryDt, normGrp(grpCd), normOwner(ownerId)];
}

/** 서버 응답 → 첫 레코드 추출 */
function extractOne(v: unknown): ChatRoomEntry | null {
    const unwrapList = (x: unknown): unknown => {
        if (Array.isArray(x)) return x;
        if (isRec(x) && Array.isArray(x['result'])) return x['result'];
        if (isRec(x) && Array.isArray(x['rows'])) return x['rows'];
        if (isRec(x) && Array.isArray(x['list'])) return x['list'];
        return x;
    };

    let cur: unknown = v;
    for (let i = 0; i < 5; i++) {
        const list = unwrapList(cur);
        if (Array.isArray(list)) {
            return list.length ? adaptInChatRoom(list[0]) : null;
        }
        if (
            isRec(cur) &&
            (isRec(cur['result']) || isRec(cur['data']) || isRec(cur['item']))
        ) {
            cur =
                (cur['result'] as unknown) ||
                (cur['data'] as unknown) ||
                (cur['item'] as unknown);
            continue;
        }
        break;
    }
    return isRec(cur) ? adaptInChatRoom(cur) : null;
}

/** 서버 응답 → 리스트 추출 */
function extractList(v: unknown): ChatRoomEntry[] {
    const unwrapList = (x: unknown): unknown => {
        if (Array.isArray(x)) return x;
        if (isRec(x) && Array.isArray(x['result'])) return x['result'];
        if (isRec(x) && Array.isArray(x['rows'])) return x['rows'];
        if (isRec(x) && Array.isArray(x['list'])) return x['list'];
        return x;
    };

    let cur: unknown = v;
    for (let i = 0; i < 5; i++) {
        const list = unwrapList(cur);
        if (Array.isArray(list)) {
            return list.map((row) => adaptInChatRoom(row));
        }
        if (
            isRec(cur) &&
            (isRec(cur['result']) || isRec(cur['data']) || isRec(cur['item']))
        ) {
            cur =
                (cur['result'] as unknown) ||
                (cur['data'] as unknown) ||
                (cur['item'] as unknown);
            continue;
        }
        break;
    }
    return [];
}

const API = {
    selectByDate: '/api/cht/chatRoom/selectChatRoomByDate',
    upsert: '/api/cht/chatRoom/upsertChatRoom',

    // ↓ 필요에 맞게 자바 쪽 URL 로 수정
    list: '/api/cht/chatRoom/selectChatRoomList',
    insert: '/api/cht/chatRoom/insertChatRoom',
    delete: '/api/cht/chatRoom/deleteChatRoom',
};

// ✅ 채팅방-유저 매핑용 API (TB_CHAT_ROOM_USER)
const API_CHAT_ROOM_USER = {
    join: '/api/cht/chatRoomUser/joinRoom',
};

async function getByDate(
    diaryDt: string,
    grpCd?: string | null,
    ownerId?: number | null,
): Promise<ChatRoomEntry | null> {
    const payload = {
        diaryDt,
        grpCd: normGrp(grpCd),
        ownerId: normOwner(ownerId),
    };
    const data = await postJson<unknown>(API.selectByDate, payload);
    return extractOne(data);
}

export function useChatRoomByDate(p: {
    diaryDt: string;
    grpCd?: string | null;
    ownerId?: number | null;
}) {
    const diaryDt = p.diaryDt;
    const grpCd = normGrp(p.grpCd ?? null);
    const ownerId = normOwner(p.ownerId ?? null);

    return useQuery<ChatRoomEntry | null, Error>({
        queryKey: keyChatRoomByDate(diaryDt, grpCd, ownerId),
        queryFn: () => getByDate(diaryDt, grpCd, ownerId),
        enabled: !!diaryDt && ownerId !== null,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 2000,
    });
}

export function useUpsertChatRoom(ctx: {
    grpCd?: string | null;
    ownerId?: number | null;
}) {
    const qc = useQueryClient();
    const ctxGrpCd = normGrp(ctx.grpCd ?? null);
    const ctxOwnerId = normOwner(ctx.ownerId ?? null);

    return useMutation<void, Error, ChatRoomUpsertInput>({
        mutationFn: async (input) => {
            const rec = input as Record<string, unknown>;

            const rawContent = rec['content'];
            const content: string =
                typeof rawContent === 'string' ? rawContent : '';

            const rawGrp = rec['grpCd'];
            const grpFromInput: string | null =
                typeof rawGrp === 'string' && rawGrp.trim() !== ''
                    ? rawGrp
                    : null;

            const rawOwner = rec['ownerId'];
            const ownerFromInput: number | null =
                typeof rawOwner === 'number' && Number.isFinite(rawOwner)
                    ? rawOwner
                    : null;

            const body: ChatRoomUpsertInput = {
                diaryDt: input.diaryDt,
                content,
                grpCd: grpFromInput ?? ctxGrpCd ?? null,
                ownerId: normOwner(ownerFromInput ?? ctxOwnerId),
            };

            await postJson<unknown>(API.upsert, body);
        },
        onSuccess: (_d, v) => {
            const rec = v as Record<string, unknown>;
            const keyDateRaw = rec['diaryDt'];
            const keyStr =
                typeof keyDateRaw === 'string'
                    ? keyDateRaw.slice(0, 10)
                    : '';
            if (keyStr) {
                qc.invalidateQueries({
                    queryKey: keyChatRoomByDate(keyStr, ctxGrpCd, ctxOwnerId),
                });
            } else {
                qc.invalidateQueries({ queryKey: ['chatRoom/byDate'] });
            }
        },
    });
}

/* === 채팅방 리스트/생성/삭제용 훅들 === */

async function getChatRoomList(): Promise<ChatRoomEntry[]> {
    const data = await postJson<unknown>(API.list, {});
    return extractList(data);
}

export function useChatRoomList() {
    return useQuery<ChatRoomEntry[], Error>({
        queryKey: ['chatRoom/list'],
        queryFn: () => getChatRoomList(),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 5000,
    });
}

export function useCreateChatRoom() {
    const qc = useQueryClient();

    return useMutation<void, Error, { roomNm: string }>({
        mutationFn: async (vars) => {
            const body: Record<string, unknown> = {
                roomNm: vars.roomNm,
            };
            await postJson<unknown>(API.insert, body);
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['chatRoom/list'] });
        },
    });
}

export function useDeleteChatRoom() {
    const qc = useQueryClient();

    return useMutation<void, Error, { roomId: number }>({
        mutationFn: async (vars) => {
            const body: Record<string, unknown> = {
                roomId: vars.roomId,
            };
            await postJson<unknown>(API.delete, body);
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['chatRoom/list'] });
        },
    });
}

/** ✅ 채팅방 입장 시 TB_CHAT_ROOM_USER upsert 요청용 타입 */
export type JoinChatRoomUserInput = {
    roomId: number;
    userId: number | null;
    senderNm: string | null;
    roleCd?: string | null;
};

/**
 * ✅ 채팅방 입장 시 TB_CHAT_ROOM_USER upsert 호출
 */
export async function joinChatRoomUser(input: JoinChatRoomUserInput): Promise<void> {
    const body: Record<string, unknown> = {
        roomId: input.roomId,
        userId: input.userId,
        senderNm: input.senderNm,
        roleCd: input.roleCd ?? 'MEMBER',
    };

    await postJson<unknown>(API_CHAT_ROOM_USER.join, body);
}