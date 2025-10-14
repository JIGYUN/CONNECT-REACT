/* filepath: src/app/features/boardPost/adapters.ts */
import type { BoardPost, PostCreate, PostUpdate } from './types';

const pick = (obj: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

/** DB → UI */
export function adaptInPost(row: any): BoardPost {
  return {
    postId: Number(pick(row, 'postId', 'POST_ID', 'id', 'boardIdx')),
    boardId: Number(pick(row, 'boardId', 'BOARD_ID')) || 1,
    writerId: pick(row, 'writerId', 'WRITER_ID'),
    writer: pick(row, 'writer', 'WRITER'),
    title: pick(row, 'title', 'TITLE') ?? '',
    contentMd: pick(row, 'contentMd', 'CONTENT_MD', 'content') ?? '',
    contentHtml: pick(row, 'contentHtml', 'CONTENT_HTML'),
    viewCnt: Number(pick(row, 'viewCnt', 'VIEW_CNT') ?? 0),
    postSttsCd: pick(row, 'postSttsCd', 'POST_STTS_CD'),
    pinnedDt: pick(row, 'pinnedDt', 'PINNED_DT'),
    deleteAt: pick(row, 'deleteAt', 'DELETE_AT'),
    createdDt: pick(row, 'createdDt', 'CREATED_DT'),
    updatedDt: pick(row, 'updatedDt', 'UPDATED_DT'),
  };
}

/** UI 등록 → 서버 payload */
export function adaptOutCreate(p: PostCreate) {
  const contentMd = p.contentMd ?? p.content ?? '';
  return {
    boardId: p.boardId ?? 1,
    title: p.title ?? '',
    contentMd,
    contentHtml: p.contentHtml,
    writer: (p as any).writer,
    writerId: (p as any).writerId,
  };
}

/** UI 수정 → 서버 payload */
export function adaptOutUpdate(p: PostUpdate) {
  const contentMd = p.contentMd ?? (p as any).content;
  return {
    postId: p.postId,
    boardId: p.boardId ?? 1,
    title: p.title,
    contentMd,
    contentHtml: p.contentHtml,
    postSttsCd: p.postSttsCd,
    pinnedDt: p.pinnedDt,
  };
}