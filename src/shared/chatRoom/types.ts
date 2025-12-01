import type { Id } from '@/shared/types/common';

/**
 * ChatRoomEntry
 * - DB 테이블 TB_CHAT_ROOM 기반
 * - PK: ROOM_ID
 */
export type ChatRoomEntry = {
    id?: Id | null;
    grpCd?: string | null;
    ownerId?: number | null;
    roomNm?: string | null;
    roomType?: string | null;
    roomDesc?: string | null;
    lastMsgContent?: string | null;
    lastMsgSentDt?: string | null;
    useAt?: string | null;
    createdDt?: string | null;
    createdBy?: number | null;
    updatedDt?: string | null;
    updatedBy?: number | null;
};

/**
 * ChatRoomUpsertInput
 * - 일자 기반 방 정보 저장용(기존 패턴 유지)
 */
export type ChatRoomUpsertInput = {
    diaryDt: string;
    content: string;
    grpCd?: string | null;
    ownerId?: number | null;
};
