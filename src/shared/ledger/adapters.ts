/* filepath: src/app/features/ledger/adapters.ts */
import type { LedgerRow } from './types';

export function adaptInLedger(x: any): LedgerRow {
  const txnId =
    x?.txnId ?? x?.TXN_ID ?? x?.id;

  const accountNm =
    x?.accountNm ?? x?.ACCOUNT_NM ?? null;

  const categoryNm =
    x?.categoryNm ?? x?.CATEGORY_NM ?? null;

  let amount = x?.amount ?? x?.AMOUNT ?? null;
  if (amount != null) {
    const n = Number(String(amount).replace(/,/g, ''));
    amount = isNaN(n) ? null : n;
  }

  const ioType =
    (x?.ioType ?? x?.IO_TYPE ?? '').toString().toUpperCase() || 'OUT';

  const fixedAt =
    (x?.fixedAt ?? x?.FIXED_AT ?? 'N') as 'Y' | 'N';

  const currencyCd =
    x?.currencyCd ?? x?.CURRENCY_CD ?? null;

  const txnDt =
    x?.txnDt ?? x?.TXN_DT ?? null;

  const ledgerDate =
    x?.ledgerDate ?? x?.LEDGER_DATE ?? null;

  const createDate =
    x?.createDate ?? x?.CREATE_DATE ?? null;

  const createdDt =
    x?.createdDt ?? x?.CREATED_DT ?? null;

  const grpCd =
    x?.grpCd ?? x?.GRP_CD ?? null;

  const ownerId =
    x?.ownerId ?? x?.OWNER_ID ?? undefined;

  return {
    txnId: txnId != null ? Number(txnId) : undefined,
    accountNm,
    categoryNm,
    amount: amount as number | null,
    ioType: ioType as any,
    fixedAt,
    currencyCd,
    txnDt,
    ledgerDate,
    createDate,
    createdDt,
    grpCd,
    ownerId: ownerId != null ? Number(ownerId) : undefined,
  };
}
