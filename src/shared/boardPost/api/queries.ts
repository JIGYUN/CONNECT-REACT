/* filepath: src/app/features/boardPost/api/queries.ts */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/shared/core/apiClient';
import { adaptInPost, adaptOutCreate, adaptOutUpdate } from '../adapters';
import type { BoardPost, PageMeta, PostCreate, PostUpdate } from '../types';

const DEFAULT_BOARD_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? '1') || 1;

function normalizeOk(payload: any): { ok: boolean; msg?: string } {
  const ok = typeof payload?.ok === 'boolean' ? payload.ok : true;
  return { ok, msg: payload?.msg };
}

/** 목록 */
export function useBoardPostList(params?: { page?: number; size?: number; kw?: string; boardId?: number }) {
  const hasPaging = !!(params?.page && params?.size);
  const boardId = params?.boardId ?? DEFAULT_BOARD_ID;

  return useQuery({
    queryKey: ['boardPostList', { ...params, boardId }],
    queryFn: async (): Promise<{ list: BoardPost[]; page?: PageMeta }> => {
      const payload = hasPaging
        ? await apiClient.post('/api/brd/boardPost/selectBoardPostListPaged', {
            page: params?.page, size: params?.size, kw: params?.kw, boardId,
          })
        : await apiClient.post('/api/brd/boardPost/selectBoardPostList', {
            kw: params?.kw, boardId,
          });

      const { ok, msg } = normalizeOk(payload);
      if (!ok) throw new Error(msg ?? 'boardPostList failed');

      const page: PageMeta | undefined = payload?.page;
      const raw = payload?.result;
      const arr: unknown[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.list) ? raw.list : []);
      return { list: arr.map(r => adaptInPost(r as any)), page };
    },
    staleTime: 10_000,
  });
}

/** 상세 */
export function useBoardPostDetail(postId?: number) {
  return useQuery({
    queryKey: ['boardPostDetail', postId],
    enabled: !!postId,
    queryFn: async (): Promise<BoardPost | null> => {
      const payload = await apiClient.post('/api/brd/boardPost/selectBoardPostDetail', { postId });
      const { ok, msg } = normalizeOk(payload);
      if (!ok) throw new Error(msg ?? 'selectBoardPostDetail failed');
      const raw = payload?.result ?? payload;
      return raw ? adaptInPost(raw as any) : null;
    },
  });
}

/** 등록(JSON) */
export function useCreateBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PostCreate) => {
      const body = { ...payload, boardId: payload.boardId ?? DEFAULT_BOARD_ID };
      const res = await apiClient.post('/api/brd/boardPost/insertBoardPost', adaptOutCreate(body));
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'insertBoardPost failed');
      return res?.result ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boardPostList'] }),
  });
}

/** 수정(JSON) */
export function useUpdateBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PostUpdate) => {
      const body = { ...payload, boardId: payload.boardId ?? DEFAULT_BOARD_ID };
      const res = await apiClient.post('/api/brd/boardPost/updateBoardPost', adaptOutUpdate(body));
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'updateBoardPost failed');
      return res?.result ?? res;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['boardPostList'] });
      qc.invalidateQueries({ queryKey: ['boardPostDetail', (v as any).postId] });
    },
  });
}

/** 삭제 */
export function useDeleteBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiClient.post('/api/brd/boardPost/deleteBoardPost', { postId });
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'deleteBoardPost failed');
      return res?.result ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boardPostList'] }),
  });
}

/* ======= 구(old) 호환 래퍼 ======= */
export function useBoardList(params?: { page?: number; size?: number; kw?: string; boardId?: number }) {
  const q = useBoardPostList(params);
  return { data: q.data?.list ?? [], page: q.data?.page, isLoading: q.isLoading, isFetching: q.isFetching, error: q.error };
}
export const useCreateBoard = useCreateBoardPost;
export const useDeleteBoard = useDeleteBoardPost;