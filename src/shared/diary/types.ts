/* filepath: src/app/features/diary/types.ts */
export type DiaryEntry = {
  diaryDt: string;          // YYYY-MM-DD
  contentHtml?: string;
  content?: string;
  fileGrpId?: number | null;
  grpCd?: string | null;
};

export type DiaryUpsertReq = {
  diaryDt: string;
  content: string;          // 서버 컬럼 CONTENT
  ownerId?: number;         // 기본 1
  grpCd?: string | null;
};