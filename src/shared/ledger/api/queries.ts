'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/core/apiClient';
import { adaptInLedger } from '../adapters';
import type { LedgerRow, LedgerCreate, LedgerDelete } from '../types';
import { useOwnerIdValue } from '@shared/core/owner';   // ✅ 리액티브 구독

const API = {
  list:   '/api/txn/ledger/selectLedgerList',
  insert: '/api/txn/ledger/insertLedger',
  remove: '/api/txn/ledger/deleteLedger',
};

const DEFAULT_OWNER_ID = 1;

// Axios/Fetch 모두 대응
function unwrap<T = any>(res: any): T {
  return (res && typeof res === 'object' && 'data' in res) ? (res.data as T) : (res as T);
}
function normalizeOk(p: any) {
  return { ok: typeof p?.ok === 'boolean' ? p.ok : true, msg: p?.msg };
}

/** 날짜/고정 여부 기준 목록 */
export const useLedgerListByDate = (params: {
  date?: string;
  fixedOnly?: boolean;
  grpCd?: string | null;
  ownerId?: number;                  // (선택) 외부 오버라이드
}) => {
  const date = params.date ?? '';
  const fixedOnly = !!params.fixedOnly;
  const grpCd = params.grpCd ?? null;

  const ownerFromStore = useOwnerIdValue();                 // ✅ store 구독
  // ✅ 우선순위: store → param → default
  const ownerId =
    (ownerFromStore ?? (typeof params.ownerId === 'number' ? params.ownerId : DEFAULT_OWNER_ID));

  return useQuery({
    queryKey: ['ledgerList', date, fixedOnly, grpCd, ownerId],     // ✅ ownerId 반영
    enabled: (!!date || fixedOnly) && !!ownerId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LedgerRow[]> => {
      const body = fixedOnly
        ? { fixedOnly: true, grpCd, ownerId }
        : {
            searchDate: date,
            ledgerDate: date,
            txnDt: date,
            createDate: date,
            from: date,
            to: date,
            grpCd,
            ownerId,
          };

      const res0 = await apiClient.post(API.list, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'selectLedgerList failed');

      const raw =
        res?.result?.list ??
        res?.result?.rows ??
        res?.result?.data ??
        (Array.isArray(res?.result) ? res.result : undefined) ??
        res?.data ??
        res;

      const arr: any[] = Array.isArray(raw) ? raw : [];
      return arr.map(adaptInLedger);
    },
    staleTime: 10_000,
  });
};

/** 등록 */
export const useInsertLedger = (params: { grpCd?: string | null; ownerId?: number }) => {
  const qc = useQueryClient();

  const ownerFromStore = useOwnerIdValue();                 // ✅ store 구독
  const ownerId =
    (ownerFromStore ?? (typeof params.ownerId === 'number' ? params.ownerId : DEFAULT_OWNER_ID));

  return useMutation({
    mutationFn: async (payload: LedgerCreate) => {
      const body = {
        accountNm: payload.accountNm,
        categoryNm: payload.categoryNm ?? null,
        amount: payload.amount,
        ioType: payload.ioType,
        fixedAt: payload.fixedAt ?? 'N',
        currencyCd: payload.currencyCd ?? 'KRW',
        txnDt: payload.txnDt,
        ledgerDate: payload.ledgerDate ?? payload.txnDt,
        createDate: payload.createDate ?? payload.txnDt,
        grpCd: payload.grpCd ?? params.grpCd ?? null,
        ownerId: payload.ownerId ?? ownerId,               // ✅ 최신 ownerId 주입
      };
      const res0 = await apiClient.post(API.insert, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'insertLedger failed');
      return res?.result ?? res;
    },
    onSuccess: (_r, v) => {
      // ownerId가 바뀌었을 때도 전부 갱신되도록 prefix 무효화
      qc.invalidateQueries({ queryKey: ['ledgerList'] });
      const d = (v as any)?.txnDt || (v as any)?.ledgerDate || (v as any)?.createDate;
      if (d) qc.invalidateQueries({ queryKey: ['ledgerList', d] as any });
    },
  });
};

/** 삭제 */
export const useDeleteLedger = (params: { ownerId?: number }) => {
  const qc = useQueryClient();

  const ownerFromStore = useOwnerIdValue();                 // ✅ store 구독
  const ownerId =
    (ownerFromStore ?? (typeof params.ownerId === 'number' ? params.ownerId : DEFAULT_OWNER_ID));

  return useMutation({
    mutationFn: async (payload: LedgerDelete) => {
      const body = { txnId: payload.txnId, ownerId };       // ✅ 함께 전송
      const res0 = await apiClient.post(API.remove, body);
      const res  = unwrap(res0);
      const { ok, msg } = normalizeOk(res);
      if (!ok) throw new Error(msg ?? 'deleteLedger failed');
      return res?.result ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ledgerList'] }),
  });
};