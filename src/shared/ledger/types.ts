/* filepath: src/app/features/ledger/types.ts */
export type LedgerRow = {
  txnId?: number;
  accountNm?: string | null;
  categoryNm?: string | null;
  amount?: number | null;
  ioType: 'IN' | 'OUT' | string;
  fixedAt?: 'Y' | 'N';
  currencyCd?: string | null;
  txnDt?: string | null;
  ledgerDate?: string | null;
  createDate?: string | null;
  createdDt?: string | null;
  grpCd?: string | null;
  ownerId?: number;
};

export type LedgerCreate = {
  accountNm: string;
  categoryNm?: string | null;
  amount: number;
  ioType: 'IN' | 'OUT';
  fixedAt?: 'Y' | 'N';
  currencyCd?: 'KRW' | string;
  txnDt: string;              // 'YYYY-MM-DD'
  ledgerDate?: string | null;
  createDate?: string | null;
  grpCd?: string | null;
  ownerId?: number;           // ✅ 추가
};

export type LedgerDelete = {
  txnId: number;
  ownerId?: number;           // ✅ 보안상 함께 전송 권장
};