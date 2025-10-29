// filepath: src/shared/ledger/api/queries.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postJson } from '@/shared/core/apiClient';
import type { ApiEnvelope } from '@/shared/types/common';
import { adaptInLedger, adaptOutLedger } from '../adapters';
import type { LedgerRow, LedgerCreate } from '../types';
import { useOwnerIdValue } from '@/shared/core/owner';

const API = {
  list: '/api/txn/ledger/selectLedgerList',
  insert: '/api/txn/ledger/insertLedger',
  remove: '/api/txn/ledger/deleteLedger',
};

const DEFAULT_OWNER_ID = Number(process.env.NEXT_PUBLIC_FAKE_OWNER_ID ?? '1');

/** 다양한 응답 포맷을 느슨하게 언래핑(인덱스 시그니처는 bracket 접근으로) */
function unwrapLoose<T>(env: unknown): T {
  if (env && typeof env === 'object') {
    const o = env as Record<string, unknown>;
    const ok = typeof o['ok'] === 'boolean' ? (o['ok'] as boolean) : undefined;
    if (ok === false) {
      const msg = 'msg' in o ? String(o['msg']) : 'API_ERROR';
      throw new Error(msg);
    }
    if ('result' in o) return o['result'] as T;
    if ('data' in o) return o['data'] as T;
  }
  return env as T;
}

type UnknownRecord = Record<string, unknown>;
function pickArray(result: unknown): UnknownRecord[] {
  if (Array.isArray(result)) return result as UnknownRecord[];
  if (!result || typeof result !== 'object') return [];
  const r = result as Record<string, unknown>;
  const cand = (r['list'] ?? r['rows'] ?? r['data']) as unknown;
  return Array.isArray(cand) ? (cand as UnknownRecord[]) : [];
}

const normOwner = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_OWNER_ID;

/* ───────── 목록 ───────── */
export function useLedgerListByDate(p: {
  date?: string;
  fixedOnly?: boolean;
  grpCd?: string | null;
  ownerId?: number;
}) {
  const date = p.date ?? '';
  const fixedOnly = !!p.fixedOnly;
  const grpCd = p.grpCd ?? null;

  const fromStore = (useOwnerIdValue as () => number | null | undefined)();
  const ownerId = normOwner(fromStore ?? p.ownerId);

  return useQuery<LedgerRow[]>({
    queryKey: ['ledger', 'list', { date, fixedOnly, grpCd, ownerId }],
    enabled: (!!date || fixedOnly) && Number.isFinite(ownerId),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const body =
        fixedOnly
          ? { fixedOnly: true, grpCd, ownerId }
          : {
              // 서버가 다양한 키를 받을 수 있도록 camelCase로만 보냄
              searchDate: date,
              ledgerDate: date,
              txnDt: date,
              createDate: date,
              from: date,
              to: date,
              grpCd,
              ownerId,
            };

      const env = await postJson<ApiEnvelope<unknown> | unknown>(API.list, body);
      const arr = pickArray(unwrapLoose<unknown>(env));
      return arr.map(adaptInLedger);
    },
  });
}

/* ───────── 등록(요청 body는 **항상 camelCase**) ───────── */
export function useInsertLedger(ctx: { grpCd?: string | null; ownerId?: number }) {
  const qc = useQueryClient();

  const fromStore = (useOwnerIdValue as () => number | null | undefined)();
  const fallbackOwnerId = normOwner(fromStore ?? ctx.ownerId);

  return useMutation<void, Error, LedgerCreate>({
    mutationFn: async (payload) => {
      const fixed: LedgerCreate = {
        ...payload,
        grpCd: payload.grpCd ?? ctx.grpCd ?? null,
        ownerId: payload.ownerId ?? fallbackOwnerId,
      };
      const body = adaptOutLedger(fixed); // ← camelCase 로 변환됨
      const env = await postJson<ApiEnvelope<unknown> | unknown>(API.insert, body);
      void unwrapLoose(env);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ledger', 'list'] });
    },
  });
}

/* ───────── 삭제(이미 camelCase) ───────── */
type LedgerDeleteInput = { txnId: number; ownerId?: number };

export function useDeleteLedger(ctx: { ownerId?: number }) {
  const qc = useQueryClient();

  const fromStore = (useOwnerIdValue as () => number | null | undefined)();
  const ownerId = normOwner(fromStore ?? ctx.ownerId);

  return useMutation<void, Error, LedgerDeleteInput>({
    mutationFn: async ({ txnId }) => {
      const env = await postJson<ApiEnvelope<unknown> | unknown>(API.remove, { txnId, ownerId });
      void unwrapLoose(env);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ledger', 'list'] });
    },
  });
}
