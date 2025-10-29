// filepath: src/shared/ledger/adapters.ts
import type { AnyRecord } from '@/shared/types/common';
import { asNumber, asString } from '@/shared/types/common';
import type { LedgerRow, LedgerCreate } from './types';

function toIoType(v: unknown): 'IN' | 'OUT' {
  const s = asString(v).toUpperCase();
  return s === 'IN' ? 'IN' : 'OUT';
}
function toYN(v: unknown): 'Y' | 'N' {
  const s = asString(v).toUpperCase();
  return s === 'Y' ? 'Y' : 'N';
}

/** 서버 → 프런트 표준화 (camelCase만 신뢰) */
export function adaptInLedger(row: AnyRecord): LedgerRow {
  // 금액 문자열 "1,234" → number
  const rawAmt = row['amount'] ?? null;
  const amount =
    rawAmt == null
      ? null
      : (() => {
          const n =
            typeof rawAmt === 'number'
              ? rawAmt
              : Number(String(rawAmt).replace(/,/g, ''));
          return Number.isFinite(n) ? n : null;
        })();

  // 선택 필드들은 값이 있을 때만 키를 포함 (exactOptionalPropertyTypes 대응)
  const txnIdCand = row['txnId'] ?? null;
  const txnId = txnIdCand != null ? asNumber(txnIdCand) : null;

  const ownerRaw = row['ownerId'] ?? null;
  const ownerId = ownerRaw != null ? asNumber(ownerRaw) : null;

  const base: Omit<LedgerRow, 'txnId' | 'ownerId'> = {
    accountNm: (row['accountNm'] ?? null) as string | null,
    categoryNm: (row['categoryNm'] ?? null) as string | null,
    amount: amount as number | null,
    ioType: toIoType(row['ioType'] ?? 'OUT'),
    fixedAt: toYN(row['fixedAt'] ?? 'N'),
    currencyCd: (row['currencyCd'] ?? 'KRW') as string | null,
    txnDt: (row['txnDt'] ?? null) as string | null,
    ledgerDate: (row['ledgerDate'] ?? null) as string | null,
    createDate: (row['createDate'] ?? null) as string | null,
    createdDt: (row['createdDt'] ?? null) as string | null,
    grpCd: (row['grpCd'] ?? null) as string | null,
  };

  return {
    ...(txnId != null ? ({ txnId } as { txnId: number }) : {}),
    ...base,
    ...(ownerId != null ? ({ ownerId } as { ownerId: number }) : {}),
  };
}

/** 프런트 → 서버 (camelCase만 전송) */
export function adaptOutLedger(input: LedgerCreate): AnyRecord {
  const out: AnyRecord = {
    accountNm: input.accountNm ?? null,
    categoryNm: input.categoryNm ?? null,
    amount: input.amount,
    ioType: input.ioType,
    fixedAt: input.fixedAt ?? 'N',
    currencyCd: input.currencyCd ?? 'KRW',
    txnDt: input.txnDt,
    ledgerDate: input.ledgerDate ?? input.txnDt,
    createDate: input.createDate ?? input.txnDt,
    grpCd: input.grpCd ?? null,
    ownerId: input.ownerId, // insert 시 반드시 포함
  };
  if (typeof input.txnId === 'number') out['txnId'] = input.txnId;
  return out;
}