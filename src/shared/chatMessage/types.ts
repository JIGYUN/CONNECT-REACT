// filepath: src/shared/chatMessage/types.ts
import type { Id } from '@/shared/types/common';

/**
 * ChatMessageEntry
 * - DB 테이블 TB_CHAT_MESSAGE 기반
 * - PK: MSG_ID
 */
export type ChatMessageEntry = {
    id?: Id | null;
    roomId?: number | null;
    senderId?: number | null;
    senderNm?: string | null;
    content?: string | null;
    contentType?: string | null;
    sentDt?: string | null;
    readCnt?: number | null;
    useAt?: string | null;
    createdDt?: string | null;
    createdBy?: number | null;
    updatedDt?: string | null;
    updatedBy?: number | null;

    // === AI 번역/엔진 필드 (TB_CHAT_MESSAGE 컬럼 + 서버 가공) ===
    translatedText?: string | null;
    translateErrorMsg?: string | null;
    engine?: string | null;
    targetLang?: string | null;
    sourceLang?: string | null;
};

/**
 * ChatMessageSendInput
 * - 클라이언트 → 서버 전송용
 */
export type ChatMessageSendInput = {
    roomId: number;
    content: string;
};
