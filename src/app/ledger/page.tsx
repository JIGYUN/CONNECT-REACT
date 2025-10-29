// filepath: src/app/ledger/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as ledgerQ from '@shared/ledger';
import type { LedgerRow, LedgerCreate } from '@shared/ledger/types';

/* helpers */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtMoney = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const monthMatrix = (y: number, m0: number) => {
  const first = new Date(y, m0, 1);
  const start = first.getDay();
  const rows: Date[][] = [];
  let day = 1 - start;
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) row.push(new Date(y, m0, day++));
    rows.push(row);
  }
  return rows;
};

export default function LedgerPage() {
  const OWNER_ID = 1;

  const sp = useSearchParams();
  const grpCd = sp.get('grpCd') ?? '';

  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const [viewY, setViewY] = useState(selected.getFullYear());
  const [viewM0, setViewM0] = useState(selected.getMonth());
  const matrix = useMemo(() => monthMatrix(viewY, viewM0), [viewY, viewM0]);
  const dateStr = toYMD(selected);

  const moveMonth = (d: number) => {
    let m = viewM0 + d, y = viewY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewM0(m); setViewY(y);
  };
  const pick = (d: Date) => {
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelected(dd);
    setViewM0(dd.getMonth());
    setViewY(dd.getFullYear());
  };

  const [fixedOnly, setFixedOnly] = useState(false);

  const [accountNm, setAccountNm] = useState('');
  const [categoryNm, setCategoryNm] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [ioType, setIoType] = useState<'IN' | 'OUT'>('OUT');
  const [fixedAt, setFixedAt] = useState(false);

  const listParams = useMemo(
    () => ({ date: dateStr, fixedOnly, grpCd, ownerId: OWNER_ID }),
    [dateStr, fixedOnly, grpCd],
  );
  const q   = ledgerQ.useLedgerListByDate(listParams);
  const ins = ledgerQ.useInsertLedger({ grpCd, ownerId: OWNER_ID });
  const del = ledgerQ.useDeleteLedger({ ownerId: OWNER_ID });

  const amountNum = useMemo(() => {
    const n = Number(String(amountStr).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);
  const onAmountChange = (v: string) => {
    const digits = v.replace(/[^\d]/g, '');
    if (!digits) return setAmountStr('');
    setAmountStr(digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  };

  const onAdd = useCallback(async () => {
    const name = accountNm.trim();
    if (!name) { alert('항목명을 입력하세요.'); return; }
    if (!(amountNum > 0)) { alert('금액을 입력하세요.'); return; }

    const payload: LedgerCreate = {
      accountNm: name,
      categoryNm: categoryNm.trim() || null,
      amount: amountNum,
      ioType,
      fixedAt: fixedAt ? 'Y' : 'N',
      currencyCd: 'KRW',
      txnDt: dateStr,
      ledgerDate: dateStr,
      createDate: dateStr,
      grpCd: grpCd || null,
      ownerId: OWNER_ID,
    };

    try {
      await ins.mutateAsync(payload);
      setAccountNm(''); setCategoryNm(''); setAmountStr(''); setFixedAt(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패');
    }
  }, [accountNm, categoryNm, amountNum, ioType, fixedAt, dateStr, grpCd, ins]);

  const onDelete = async (txnId: number) => {
    if (!txnId) return;
    if (!confirm('삭제하시겠습니까?')) return;
    try { await del.mutateAsync({ txnId, ownerId: OWNER_ID }); }
    catch (e) { alert(e instanceof Error ? e.message : '삭제 실패'); }
  };

  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Enter') onAdd(); };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [onAdd]);

  const rows: LedgerRow[] = (q.data ?? []) as LedgerRow[];
  const kpi = useMemo(() => {
    let inSum = 0, outSum = 0;
    rows.forEach((r) => {
      const t = String(r.ioType).toUpperCase();
      if (t === 'IN')  inSum  += r.amount ?? 0;
      if (t === 'OUT') outSum += r.amount ?? 0;
    });
    return { inSum, outSum, net: inSum - outSum, count: rows.length };
  }, [rows]);

  const weekday = ['일','월','화','수','목','금','토'];
  const monthLabel = `${viewY}.${pad(viewM0 + 1)}`;

  return (
    <div className="mx-auto max-w-[640px] px-4 py-4">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50" onClick={() => moveMonth(-1)} aria-label="이전 달">◀</button>
          <div className="text-lg font-bold">{monthLabel}</div>
          <button className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50" onClick={() => moveMonth(1)} aria-label="다음 달">▶</button>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-70">건수</div>
          <div className="text-base font-semibold">{kpi.count.toLocaleString()} 건</div>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="mb-1 text-xs opacity-70">수입</div>
          <div className="text-lg font-bold">{fmtMoney(kpi.inSum)}원</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="mb-1 text-xs opacity-70">지출</div>
          <div className="text-lg font-bold">{fmtMoney(kpi.outSum)}원</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="mb-1 text-xs opacity-70">순합</div>
          <div className="text-lg font-bold">{fmtMoney(kpi.net)}원</div>
        </div>
      </div>

      {/* 달력 */}
      <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-7 bg-slate-50 text-center text-xs">
          {weekday.map((w) => <div key={w} className="py-2 font-medium">{w}</div>)}
        </div>
        <div className="divide-y divide-slate-100">
          {matrix.map((week, i) => (
            <div key={i} className="grid grid-cols-7 text-center">
              {week.map((d) => {
                const inMonth = d.getMonth() === viewM0 && d.getFullYear() === viewY;
                const isSel =
                  d.getFullYear() === selected.getFullYear() &&
                  d.getMonth() === selected.getMonth() &&
                  d.getDate() === selected.getDate();
                const isToday = (() => {
                  const t = new Date();
                  return (
                    t.getFullYear() === d.getFullYear() &&
                    t.getMonth() === d.getMonth() &&
                    t.getDate() === d.getDate()
                  );
                })();

                const base = 'relative select-none rounded-md py-2 text-sm transition cursor-pointer';
                const tone = inMonth ? 'text-slate-800' : 'text-slate-400';
                const sel = isSel ? 'ring-2 ring-indigo-500/60 font-semibold' : '';
                const todayBadge = isToday
                  ? 'after:absolute after:-top-1.5 after:right-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-indigo-500/80'
                  : '';

                return (
                  <div
                    key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                    onClick={() => pick(d)}
                    className={`${base} ${tone} ${sel} ${todayBadge} hover:bg-slate-50`}
                  >
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 필터 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{toYMD(selected)}</div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={fixedOnly}
            onChange={(e) => setFixedOnly(e.target.checked)}
          />
          고정 항목만
        </label>
      </div>

      {/* 입력 폼 */}
      <div ref={formRef} className="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
            placeholder="항목명(예: 점심)"
            value={accountNm}
            onChange={(e) => setAccountNm(e.target.value)}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
            placeholder="카테고리(선택)"
            value={categoryNm}
            onChange={(e) => setCategoryNm(e.target.value)}
          />
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            inputMode="numeric"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
            placeholder="금액"
            value={amountStr}
            onChange={(e) => onAmountChange(e.target.value)}
          />

          {/* ✅ 완전 고정: 줄바꿈/잘림 방지 */}
          <div className="rounded-lg px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-nowrap items-center gap-6 whitespace-nowrap">
              <label className="inline-flex select-none items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="ioType"
                  className="size-4 accent-indigo-600"
                  checked={ioType === 'OUT'}
                  onChange={() => setIoType('OUT')}
                />
                <span>지출</span>
              </label>
              <label className="inline-flex select-none items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="ioType"
                  className="size-4 accent-indigo-600"
                  checked={ioType === 'IN'}
                  onChange={() => setIoType('IN')}
                />
                <span>수입</span>
              </label>
              <label className="inline-flex select-none items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-indigo-600"
                  checked={fixedAt}
                  onChange={(e) => setFixedAt(e.target.checked)}
                />
                <span>고정</span>
              </label>
            </div>
          </div>
        </div>

        <button
          className="mt-3 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white shadow-sm hover:bg-slate-800"
          onClick={onAdd}
          disabled={ins.isPending}
        >
          {ins.isPending ? '저장 중…' : '추가'}
        </button>
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {q.isLoading && <div className="text-sm text-slate-500">불러오는 중…</div>}
        {q.error && <div className="text-sm text-rose-600">{(q.error as Error).message ?? '오류가 발생했습니다.'}</div>}
        {!q.isLoading && rows.length === 0 && <div className="text-sm text-slate-400">항목이 없습니다.</div>}

        {rows.map((r) => {
          const id = (r as { txnId?: number }).txnId ?? 0;
          const sign = String(r.ioType).toUpperCase() === 'IN' ? '+' : '-';
          const tone = sign === '+' ? 'text-indigo-600' : 'text-rose-600';
          return (
            <div key={`${id}-${r.accountNm}-${r.amount}`} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.accountNm ?? '(항목)'}</div>
                <div className={`text-sm font-bold ${tone}`}>{sign} {fmtMoney(r.amount)}원</div>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <div className="truncate">
                  {r.categoryNm ?? '기타'} · {r.currencyCd ?? 'KRW'} · {r.fixedAt === 'Y' ? '고정' : '변동'}
                </div>
                <button className="rounded-lg px-2 py-1 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50" onClick={() => onDelete(id)} disabled={del.isPending}>
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
