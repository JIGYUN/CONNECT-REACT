/* filepath: src/app/features/diary/api/queries.ts */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/core/apiClient';
import { adaptInDiary, adaptOutUpsert } from '../adapters';
import type { DiaryEntry } from '../types';
import { useOwnerIdValue } from '@shared/core/owner';   // ✅ 변경: 구독 훅 사용

const DEFAULT_OWNER_ID = Number(process.env.NEXT_PUBLIC_FAKE_OWNER_ID ?? '1');

const API = {
  select: '/api/tsk/diary/selectDiaryByDate',
  upsert: '/api/tsk/diary/upsertDiary',
};

// 공통 유틸
function unwrap<T = any>(res: any): T {
  return res && typeof res === 'object' && 'data' in res ? (res.data as T) : (res as T);
}
function normalizeOk(p: any) {
  return { ok: typeof p?.ok === 'boolean' ? p.ok : true, msg: p?.msg };
}

/** 단건 조회(날짜 기준) — ownerId 리액티브 반영 */
export function useDiaryByDate(params: {
  diaryDt?: string;
  grpCd?: string | null;
  ownerId?: number;        // (선택) 강제 오버라이드
}) {
  const diaryDt = params.diaryDt;
  const grpCd = params.grpCd ?? null;
  const ownerFromStore = useOwnerIdValue();             // ✅ 구독
  const ownerId = Number(
    params.ownerId ?? ownerFromStore ?? DEFAULT_OWNER_ID
  );

  return useQuery({
    queryKey: ['diary', diaryDt, grpCd, ownerId],       // ✅ ownerId 바뀌면 re-fetch
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

/** 업서트 — ownerId/ grpCd 포함 (리액티브) */
export function useUpsertDiary(params: { grpCd?: string | null; ownerId?: number }) {
  const qc = useQueryClient();
  const ownerFromStore = useOwnerIdValue();             // ✅ 구독
  const ownerId = Number(
    params.ownerId ?? ownerFromStore ?? DEFAULT_OWNER_ID
  );

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