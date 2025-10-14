/* filepath: src/app/features/boardPost/types.ts */

export type PageMeta = {
  page: number;
  size: number;
  total: number;
};

export type BoardPost = {
  postId: number;
  boardId: number;
  writerId?: number | string;
  writer?: string;
  title: string;
  contentMd?: string;
  contentHtml?: string;
  viewCnt?: number;
  postSttsCd?: string;
  pinnedDt?: string | null;
  deleteAt?: string | null;
  createdDt?: string;
  updatedDt?: string;
};

export type PostCreate = {
  boardId?: number;
  title: string;
  content?: string;      // 단일 content 사용 시
  contentMd?: string;
  contentHtml?: string;
  writer?: string;
  writerId?: number | string;
};

export type PostUpdate = {
  postId: number;
  boardId?: number;
  title?: string;
  content?: string;
  contentMd?: string;
  contentHtml?: string;
  postSttsCd?: string;
  pinnedDt?: string | null;
};