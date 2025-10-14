/* filepath: src/app/features/diary/api/queries.ts */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/core/apiClient';
import { adaptInDiary, adaptOutUpsert } from '../adapters';
import type { DiaryEntry } from '../types';

// 로그인 붙기 전 임시: ownerId 기본값을 1로
const DEFAULT_OWNER_ID = Number(process.env.NEXT_PUBLIC_FAKE_OWNER_ID ?? '1');

const API = {
  select: '/api/tsk/diary/selectDiaryByDate',
  upsert: '/api/tsk/diary/upsertDiary',
};

// Axios/Fetch 모두 대응
function unwrap<T = any>(res: any): T {
  return res && typeof res === 'object' && 'data' in res ? (res.data as T) : (res as T);
}
function normalizeOk(p: any) {
  return { ok: typeof p?.ok === 'boolean' ? p.ok : true, msg: p?.msg };
}

/** 단건 조회(날짜 기준) — ownerId 포함 */
export function useDiaryByDate(params: {
  diaryDt?: string;
  grpCd?: string | null;
  ownerId?: number; // 기본 1
}) {
  const diaryDt = params.diaryDt;
  const grpCd = params.grpCd ?? null;
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useQuery({
    queryKey: ['diary', diaryDt, grpCd, ownerId],
    enabled: !!diaryDt,
    queryFn: async (): Promise<DiaryEntry | null> => {
      const body: any = { diaryDt, ownerId };
      if (grpCd) body.grpCd = grpCd;

      const res0 = await apiClient.post(API.select, body);
      const res = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'selectDiaryByDate failed');

      const raw = res?.result ?? res;
      return raw ? adaptInDiary(raw) : null;
    },
    staleTime: 10_000,
  });
}

/** 업서트 — ownerId/ grpCd 포함 */
export function useUpsertDiary(params: { grpCd?: string | null; ownerId?: number }) {
  const qc = useQueryClient();
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;

  return useMutation({
    mutationFn: async (input: { diaryDt: string; content: string }) => {
      const body = adaptOutUpsert({
        diaryDt: input.diaryDt,
        content: input.content,
        ownerId,
        grpCd: params.grpCd ?? null,
      });

      const res0 = await apiClient.post(API.upsert, body);
      const res = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'upsertDiary failed');
      return res?.result ?? res;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({
        queryKey: ['diary', (v as any)?.diaryDt, params.grpCd ?? null, ownerId],
      });
    },
  });
}