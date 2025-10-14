/* filepath: src/app/ledger/page.tsx */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as ledgerQ from '@shared/ledger';

/* ===== Utils (Tasks 스타일) ===== */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function monthMatrix(y: number, m0: number) {
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
}

/* ===== 가게부 전용 ===== */
const fmtMoney = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function LedgerPage() {
  // ✅ 모든 API에 함께 보낼 고정 ownerId
  const OWNER_ID = 1;

  const sp = useSearchParams();
  const grpCd = sp.get('grpCd') ?? '';

  // 달력
  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(
    new Date(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [viewY, setViewY] = useState(selected.getFullYear());
  const [viewM0, setViewM0] = useState(selected.getMonth());
  const matrix = useMemo(() => monthMatrix(viewY, viewM0), [viewY, viewM0]);
  const dateStr = toYMD(selected);

  const moveMonth = (d: number) => {
    let m = viewM0 + d,
      y = viewY;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setViewM0(m);
    setViewY(y);
  };
  const pick = (d: Date) => {
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelected(dd);
    setViewM0(dd.getMonth());
    setViewY(dd.getFullYear());
  };

  // 입력 상태
  const [accountNm, setAccountNm] = useState('');
  const [categoryNm, setCategoryNm] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [ioType, setIoType] = useState<'IN' | 'OUT'>('OUT');
  const [fixedAt, setFixedAt] = useState(false);

  // 필터
  const [fixedOnly, setFixedOnly] = useState(false);

  // 쿼리 훅 (✅ ownerId 포함)
  const listParams = useMemo(
    () => ({ date: dateStr, fixedOnly, grpCd, ownerId: OWNER_ID }),
    [dateStr, fixedOnly, grpCd]
  );
  const q = ledgerQ.useLedgerListByDate(listParams);
  const ins = ledgerQ.useInsertLedger({ grpCd, ownerId: OWNER_ID });
  const del = ledgerQ.useDeleteLedger({ ownerId: OWNER_ID });

  // 금액 숫자화
  const amountNum = useMemo(() => {
    const n = Number(String(amountStr).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }, [amountStr]);

  // 추가
  const onAdd = async () => {
    if (!accountNm.trim()) return;
    if (!(amountNum > 0)) return;

    const payload: ledgerQ.LedgerCreate = {
      accountNm: accountNm.trim(),
      categoryNm: categoryNm.trim() || null,
      amount: amountNum,
      ioType,
      fixedAt: fixedAt ? 'Y' : 'N',
      currencyCd: 'KRW',
      txnDt: dateStr,
      ledgerDate: dateStr,
      createDate: dateStr,
      grpCd: grpCd || null,
      ownerId: OWNER_ID, // ✅ 명시적으로 포함
    };
    try {
      await ins.mutateAsync(payload);
      setAccountNm('');
      setCategoryNm('');
      setAmountStr('');
      setFixedAt(false);
    } catch (e: any) {
      alert(e?.message ?? '등록 실패');
    }
  };

  // 삭제
  const onDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await del.mutateAsync({ txnId: id, ownerId: OWNER_ID }); // ✅ 함께 전송
    } catch (e: any) {
      alert(e?.message ?? '삭제 실패');
    }
  };

  // Enter로 빠른 추가
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onAdd();
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAdd]);

  // KPI
  const kpi = useMemo(() => {
    const rows = q.data ?? [];
    let inSum = 0,
      outSum = 0;
    rows.forEach((r) => {
      const t = String(r.ioType).toUpperCase();
      if (t === 'IN') inSum += r.amount ?? 0;
      if (t === 'OUT') outSum += r.amount ?? 0;
    });
    return { inSum, outSum, net: inSum - outSum, count: rows.length };
  }, [q.data]);

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>가게부</h2>
        <span
          style={{
            fontSize: 12,
            padding: '4px 10px',
            border: '1px solid #e9edf3',
            borderRadius: 999,
          }}
        >
          grpCd: <b>{grpCd || '개인'}</b>
        </span>
      </div>

      {/* 캘린더 + 퀵추가 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          alignItems: 'start',
          marginBottom: 16,
        }}
      >
        {/* 달력 카드 */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e9edf3',
            borderRadius: 16,
            boxShadow: '0 6px 16px rgba(15,23,42,.05)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => moveMonth(-1)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                border: '1px solid #e9edf3',
                borderRadius: 8,
                padding: '4px 8px',
                background: '#fff',
              }}
            >
              {'«'}
            </button>
            <div style={{ fontWeight: 800, letterSpacing: 0.3, marginRight: 'auto' }}>
              {viewY}년 {pad(viewM0 + 1)}월
            </div>
            <button
              onClick={() => moveMonth(1)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                border: '1px solid #e9edf3',
                borderRadius: 8,
                padding: '4px 8px',
                background: '#fff',
              }}
            >
              {'»'}
            </button>
            <button
              onClick={() => {
                const t = new Date();
                setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
                setViewY(t.getFullYear());
                setViewM0(t.getMonth());
              }}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                border: '1px solid #e9edf3',
                borderRadius: 8,
                padding: '4px 10px',
                background: '#fff',
              }}
            >
              오늘
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <div
                key={w}
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#64748b',
                  fontWeight: 700,
                  padding: '6px 0',
                  border: '1px solid #e9edf3',
                  borderRadius: 10,
                  background: '#fff',
                }}
              >
                {w}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7,1fr)',
              gap: 6,
              background: '#fff',
              border: '1px solid #e9edf3',
              borderRadius: 12,
              padding: 12,
              minHeight: 264,
            }}
          >
            {matrix.flat().map((d, i) => {
              const inMonth = d.getMonth() === viewM0;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const isToday = d0.getTime() === today.getTime();
              const isSel =
                d0.getTime() === new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    border: '1px solid #e9edf3',
                    borderRadius: 10,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600,
                    color: '#334155',
                    opacity: inMonth ? 1 : 0.35,
                    background: isSel ? '#e0ecff' : '#fff',
                    boxShadow: isToday ? '0 0 0 2px #dbeafe inset' : undefined,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* 빠른 추가 */}
        <div
          ref={formRef}
          style={{
            background: '#fff',
            border: '1px solid #e9edf3',
            borderRadius: 16,
            boxShadow: '0 6px 16px rgba(15,23,42,.05)',
            padding: 16,
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>제목(계정명)</div>
              <input
                placeholder="예: 점심 - 김밥"
                value={accountNm}
                onChange={(e) => setAccountNm(e.target.value)}
                style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>카테고리</div>
                <input
                  placeholder="예: 식비 / 교통"
                  value={categoryNm}
                  onChange={(e) => setCategoryNm(e.target.value)}
                  style={{ width: '100%', height: 38, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>금액</div>
                <div style={{ display: 'flex' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      border: '1px solid #e5e7eb',
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      background: '#fff',
                      color: '#374151',
                    }}
                  >
                    ₩
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      border: '1px solid #e5e7eb',
                      borderRadius: '0 8px 8px 0',
                      padding: '0 10px',
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>유형</div>
              <div style={{ display: 'flex' }}>
                <button
                  type="button"
                  onClick={() => setIoType('IN')}
                  style={{
                    flex: 1,
                    height: 38,
                    border: '1px solid',
                    padding: '0 10px',
                    borderRadius: '8px 0 0 8px',
                    borderColor: ioType === 'IN' ? '#a7f3d0' : '#e5e7eb',
                    background: ioType === 'IN' ? '#ecfdf5' : '#fff',
                    color: ioType === 'IN' ? '#065f46' : '#374151',
                  }}
                >
                  수입
                </button>
                <button
                  type="button"
                  onClick={() => setIoType('OUT')}
                  style={{
                    flex: 1,
                    height: 38,
                    border: '1px solid',
                    padding: '0 10px',
                    borderRadius: '0 8px 8px 0',
                    borderColor: ioType === 'OUT' ? '#fecdd3' : '#e5e7eb',
                    background: ioType === 'OUT' ? '#fff1f2' : '#fff',
                    color: ioType === 'OUT' ? '#9f1239' : '#374151',
                  }}
                >
                  지출
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={fixedAt} onChange={(e) => setFixedAt(e.target.checked)} />
                고정
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Enter 키로도 저장됩니다.</span>
                <button
                  onClick={onAdd}
                  disabled={ins.isPending}
                  style={{
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 8,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    opacity: ins.isPending ? 0.6 : 1,
                  }}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e9edf3',
          borderRadius: 16,
          boxShadow: '0 6px 16px rgba(15,23,42,.05)',
          padding: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#0f172a' }}>목록</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={fixedOnly} onChange={(e) => setFixedOnly(e.target.checked)} />
              고정만 보기
            </label>
            {!q.isLoading && (
              <div style={{ fontSize: 13, color: '#64748b' }}>
                총 {kpi.count}건 · 수입 {fmtMoney(kpi.inSum)} · 지출 {fmtMoney(kpi.outSum)} · 순변화{' '}
                {fmtMoney(kpi.net)}
              </div>
            )}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f5f8', color: '#475569' }}>
              <th style={{ width: 90, padding: '10px 8px', textAlign: 'right' }}>번호</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>제목 / 카테고리</th>
              <th style={{ width: 160, padding: '10px 8px', textAlign: 'right' }}>금액</th>
              <th style={{ width: 100, padding: '10px 8px' }}>고정</th>
              <th style={{ width: 200, padding: '10px 8px' }}>작성일</th>
              <th style={{ width: 90, padding: '10px 8px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                  불러오는 중…
                </td>
              </tr>
            )}

            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                  데이터가 없습니다.
                </td>
              </tr>
            )}

            {q.data?.map((r) => {
              const isIn = String(r.ioType).toUpperCase() === 'IN';
              const amt = fmtMoney(r.amount);
              const day = r.txnDt || r.createdDt || '';
              return (
                <tr key={r.txnId} style={{ cursor: 'default' }}>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.txnId}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.accountNm}</div>
                      {r.categoryNm && <span style={{ fontSize: 12, color: '#6b7280' }}>#{r.categoryNm}</span>}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '10px 8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: isIn ? '#0ea5e9' : '#ef4444',
                    }}
                  >
                    {isIn ? '+' : '-'}
                    {amt}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.fixedAt === 'Y' && (
                      <span
                        style={{
                          fontSize: 12,
                          borderRadius: 999,
                          padding: '2px 8px',
                          color: '#fff',
                          background: '#111827',
                        }}
                      >
                        고정
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>{day}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => onDelete(r.txnId!)}
                      disabled={del.isPending}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#9f1239',
                        opacity: del.isPending ? 0.6 : 1,
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>CONNECT · v1</div>
    </div>
  );
}