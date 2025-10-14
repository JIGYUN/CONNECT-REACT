/* filepath: src/app/features/diary/adapters.ts */
import type { DiaryEntry, DiaryUpsertReq } from './types';

/** 서버 → 프론트 */
export function adaptInDiary(row: any): DiaryEntry {
  if (!row) return { diaryDt: '' };

  const diaryDt =
    row.diaryDt ?? row.DIARY_DT ?? row.diaryDate ?? row.DIARY_DATE ?? '';

  const contentHtml = row.contentHtml ?? row.CONTENT_HTML ?? undefined;
  const content     = row.content     ?? row.CONTENT      ?? undefined;

  const fileGrpId = row.fileGrpId ?? row.FILE_GRP_ID ?? null;
  const grpCd     = row.grpCd     ?? row.GRP_CD      ?? null;

  return {
    diaryDt: String(diaryDt || ''),
    contentHtml: contentHtml ? String(contentHtml) : undefined,
    content:     content     ? String(content)     : undefined,
    fileGrpId: fileGrpId != null ? Number(fileGrpId) : null,
    grpCd: grpCd ?? null,
  };
}

/** 프론트 → 서버 (업서트 바디) */
export const adaptOutUpsert = (input: DiaryUpsertReq) => {
  const body: any = {
    diaryDt: input.diaryDt,
    content: input.content,
  };
  if (input.ownerId != null) body.ownerId = input.ownerId;
  if (input.grpCd) body.grpCd = input.grpCd;
  return body;
};