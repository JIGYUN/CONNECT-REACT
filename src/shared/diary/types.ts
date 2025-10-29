// filepath: src/shared/diary/types.ts
import type { Id } from '@/shared/types/common';

/**
 * 프런트 표준: ymd = 'YYYY-MM-DD'
 * 서버 호환을 위해 body/content는 선택적 필드로 둔다.
 */
export type DiaryEntry = {
    id?: Id | null;
    ymd: string;
    title?: string | null;
    body?: string | null;     // 표준 본문
    content?: string | null;  // 레거시/서버 별칭
    ownerId: Id | null;
};

export type DiaryUpsertInput = {
    diaryDt: string;                // 서버 파라미터 명세 유지
    content: string;
    grpCd?: string | null;
    ownerId?: Id | null;
};