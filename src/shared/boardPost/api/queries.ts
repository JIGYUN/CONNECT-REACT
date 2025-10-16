// filepath: src/shared/boardPost/api/queries.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/shared/core/apiClient';
import type { ApiEnvelope, ListResult } from '@/shared/types/common';
import type { BoardPost, BoardPostUpsert } from '@/shared/boardPost/types';
import { adaptInBoardPost, adaptOutBoardPost } from '@/shared/boardPost/adapters';

const API = {
  list: '/api/brd/post/list',
  detail: '/api/brd/post/detail',
  upsert: '/api/brd/post/upsert',
  remove: '/api/brd/post/delete',
};

function unwrap<T>(res: { data: ApiEnvelope<T> }): T {
  if (!res.data.ok) throw new Error(res.data.msg ?? 'API_ERROR');
  return res.data.result;
}

/** 게시글 목록 (페이징) */
export function useBoardPostList(query: { page?: number; size?: number }) {
  const { page = 1, size = 20 } = query;
  return useQuery({
    queryKey: ['boardPost', 'list', { page, size }],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ListResult<Record<string, unknown>>>>(
        API.list,
        { params: { page, size } },
      );
      const raw = unwrap(res);
      return {
        ...raw,
        rows: raw.rows.map(adaptInBoardPost),
      } as ListResult<BoardPost>;
    },
  });
}

/** 게시글 상세 */
export function useBoardPostDetail(postId: number) {
  return useQuery({
    queryKey: ['boardPost', 'detail', postId],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Record<string, unknown>>>(API.detail, {
        params: { postId },
      });
      return adaptInBoardPost(unwrap(res));
    },
    enabled: Number.isFinite(postId),
  });
}

/** 게시글 등록/수정 */
export function useUpsertBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BoardPostUpsert) => {
      const res = await apiClient.post<ApiEnvelope<number>>(API.upsert, adaptOutBoardPost(input));
      return unwrap(res); // 새 PK
    },
    onSuccess: (_id, input) => {
      void qc.invalidateQueries({ queryKey: ['boardPost', 'list'] });
      if (input.postId) {
        void qc.invalidateQueries({ queryKey: ['boardPost', 'detail', input.postId] });
      }
    },
  });
}

/** 게시글 삭제 */
export function useDeleteBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiClient.post<ApiEnvelope<boolean>>(API.remove, { postId });
      return unwrap(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['boardPost', 'list'] });
    },
  });
}