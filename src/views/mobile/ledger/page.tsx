/* filepath: src/views/mobile/ledger/page.tsx */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as ledgerQ from '@shared/ledger';

/* ===== Utils ===== */
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

const fmtMoney = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function LedgerMobilePage() {
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
    let m = viewM0 + d, y = viewY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewM0(m); setViewY(y);
  };
  const pick = (d: Date) => {
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelected(dd); setViewM0(dd.getMonth()); setViewY(dd.getFullYear());
  };

  // 폼 상태
  const [accountNm, setAccountNm] = useState('');
  const [categoryNm, setCategoryNm] = useState('');
  const [amountStr,  setAmountStr]  = useState('');
  const [ioType,     setIoType]     = useState<'IN'|'OUT'>('OUT');
  const [fixedAt,    setFixedAt]    = useState(false);

  // 필터
  const [fixedOnly, setFixedOnly] = useState(false);

  // 쿼리
  const listParams = useMemo(
    () => ({ date: dateStr, fixedOnly, grpCd, ownerId: OWNER_ID }),
    [dateStr, fixedOnly, grpCd]
  );
  const q   = ledgerQ.useLedgerListByDate(listParams);
  const ins = ledgerQ.useInsertLedger({ grpCd, ownerId: OWNER_ID });
  const del = ledgerQ.useDeleteLedger({ ownerId: OWNER_ID });

  const amountNum = useMemo(() => {
    const n = Number(String(amountStr).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }, [amountStr]);

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
      txnDt: dateStr, ledgerDate: dateStr, createDate: dateStr,
      grpCd: grpCd || null,
      ownerId: OWNER_ID,
    };
    try {
      await ins.mutateAsync(payload);
      setAccountNm(''); setCategoryNm(''); setAmountStr(''); setFixedAt(false);
    } catch (e: any) { alert(e?.message ?? '등록 실패'); }
  };

  const onDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try { await del.mutateAsync({ txnId: id, ownerId: OWNER_ID }); }
    catch (e: any) { alert(e?.message ?? '삭제 실패'); }
  };

  // Enter로 저장
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = formRef.current; if (!el) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Enter') onAdd(); };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAdd]);

  const kpi = useMemo(() => {
    const rows = q.data ?? [];
    let inSum = 0, outSum = 0;
    rows.forEach(r => {
      const t = String(r.ioType).toUpperCase();
      if (t === 'IN')  inSum  += (r.amount ?? 0);
      if (t === 'OUT') outSum += (r.amount ?? 0);
    });
    return { inSum, outSum, net: inSum - outSum, count: rows.length };
  }, [q.data]);

  return (
    <div className="wrap">
      {/* 헤더 */}
      <div className="head">
        <h2>가게부</h2>
        <span className="chip">grpCd: <b>{grpCd || '개인'}</b></span>
      </div>

      {/* 달력 */}
      <section className="card">
        <div className="cal-head">
          <button onClick={() => moveMonth(-1)}>{'«'}</button>
          <div className="cal-title">{viewY}년 {pad(viewM0+1)}월</div>
          <button onClick={() => moveMonth(1)}>{'»'}</button>
          <button onClick={() => {
            const t = new Date();
            setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
            setViewY(t.getFullYear()); setViewM0(t.getMonth());
          }}>오늘</button>
        </div>

        <div className="cal-week">
          {['일','월','화','수','목','금','토'].map(w => (
            <div key={w} className="cal-weekcell">{w}</div>
          ))}
        </div>

        <div className="cal-grid">
          {matrix.flat().map((d, i) => {
            const inMonth = d.getMonth() === viewM0;
            const today = new Date(); today.setHours(0,0,0,0);
            const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = d0.getTime() === today.getTime();
            const isSel = d0.getTime() === new Date(
              selected.getFullYear(), selected.getMonth(), selected.getDate()
            ).getTime();
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(d)}
                className={[
                  'cal-day',
                  inMonth ? '' : 'is-dim',
                  isSel ? 'is-sel' : '',
                  isToday && !isSel ? 'is-today' : '',
                ].join(' ')}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      {/* 입력 폼: 세로형 */}
      <section ref={formRef} className="card form">
        <div className="field">
          <label>제목(계정명)</label>
          <input
            className="input"
            placeholder="예: 점심 - 김밥"
            value={accountNm}
            onChange={e=>setAccountNm(e.target.value)}
          />
        </div>

        <div className="field">
          <label>카테고리</label>
          <input
            className="input"
            placeholder="예: 식비 / 교통"
            value={categoryNm}
            onChange={e=>setCategoryNm(e.target.value)}
          />
        </div>

        <div className="field">
          <label>금액</label>
          <div className="money">
            <span>₩</span>
            <input
              type="number" min={0} step="0.01" placeholder="0"
              value={amountStr}
              onChange={e=>setAmountStr(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>유형</label>
          <div className="seg">
            <button
              type="button"
              onClick={()=>setIoType('IN')}
              className={`seg-btn ${ioType==='IN' ? 'on-in' : ''}`}
            >수입</button>
            <button
              type="button"
              onClick={()=>setIoType('OUT')}
              className={`seg-btn ${ioType==='OUT' ? 'on-out' : ''}`}
            >지출</button>
          </div>
        </div>

        <div className="form-foot">
          <label className="chk">
            <input type="checkbox" checked={fixedAt} onChange={e=>setFixedAt(e.target.checked)} />
            고정
          </label>
          <div className="actions">
            <span className="hint">Enter 키로도 저장됩니다.</span>
            <button onClick={onAdd} disabled={ins.isPending} className="cta">추가</button>
          </div>
        </div>
      </section>

      {/* KPI & 필터 */}
      <section className="kpi-row">
        <label className="chk">
          <input type="checkbox" checked={fixedOnly} onChange={e=>setFixedOnly(e.target.checked)} />
          고정만 보기
        </label>
        <div className="kpis">
          <span className="pill">총 {kpi.count}건</span>
          <span className="pill blue">수입 {fmtMoney(kpi.inSum)}</span>
          <span className="pill red">지출 {fmtMoney(kpi.outSum)}</span>
          <span className="pill dark">순변화 {fmtMoney(kpi.net)}</span>
        </div>
      </section>

      {/* 목록: 카드 리스트 */}
      <section className="list">
        {q.isLoading && <div className="empty">불러오는 중…</div>}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <div className="empty">데이터가 없습니다.</div>
        )}

        <ul className="cards">
          {q.data?.map(r => {
            const isIn = String(r.ioType).toUpperCase() === 'IN';
            const amt  = fmtMoney(r.amount);
            const day  = r.txnDt || r.createdDt || '';
            return (
              <li key={r.txnId} className="item">
                <div className="item-top">
                  <div className="title-wrap">
                    <div className="name">{r.accountNm}</div>
                    {r.categoryNm && <span className="tag">#{r.categoryNm}</span>}
                    {r.fixedAt === 'Y' && <span className="badge">고정</span>}
                  </div>
                  <div className={`amount ${isIn ? 'in' : 'out'}`}>
                    {isIn ? '+' : '-'}{amt}
                  </div>
                </div>
                <div className="meta">
                  <span className="mono">#{r.txnId}</span>
                  <span>{day}</span>
                </div>
                <div className="item-act">
                  <button
                    onClick={()=>onDelete(r.txnId!)}
                    disabled={del.isPending}
                    className="btn-del"
                  >삭제</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="footer">CONNECT · v1</div>

      {/* ===== Styles (단일 styled-jsx) ===== */}
      <style jsx>{`
        :global(*){box-sizing:border-box}
        .wrap{max-width:560px;margin:0 auto;padding:16px}
        .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .head h2{margin:0;font-size:20px}
        .chip{font-size:12px;padding:4px 10px;border:1px solid #e9edf3;border-radius:999px}

        .card{
          background:#fff;border:1px solid #e9edf3;border-radius:16px;
          box-shadow:0 6px 16px rgba(15,23,42,.05);padding:12px;margin-bottom:12px;
        }

        /* Calendar */
        .cal-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .cal-head button{appearance:none;border:1px solid #e9edf3;background:#fff;border-radius:8px;padding:6px 10px}
        .cal-title{font-weight:800;letter-spacing:.3px;margin-right:auto}
        .cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px}
        .cal-weekcell{
          text-align:center;font-weight:700;color:#64748b;border:1px solid #e9edf3;border-radius:10px;background:#fff;
          padding:6px 0;font-size:12px;
        }
        .cal-grid{
          display:grid;grid-template-columns:repeat(7,1fr);gap:6px;background:#fff;border:1px solid #e9edf3;border-radius:12px;padding:10px;
        }
        .cal-day{
          height:40px;border:1px solid #e9edf3;border-radius:10px;display:flex;align-items:center;justify-content:center;
          font-weight:600;color:#334155;background:#fff;user-select:none
        }
        .cal-day.is-dim{opacity:.38}
        .cal-day.is-sel{background:#e0ecff}
        .cal-day.is-today{box-shadow:inset 0 0 0 2px #dbeafe}

        /* Form */
        .form .field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
        .form label{font-size:13px;color:#6b7280}
        .input{
          width:100%;height:42px;border:1px solid #e5e7eb;border-radius:10px;padding:0 12px;background:#fff;
          -webkit-appearance:none;appearance:none
        }
        .money{display:flex;align-items:center;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
        .money>span{display:inline-flex;align-items:center;padding:0 12px;border-right:1px solid #e5e7eb;background:#fff}
        .money>input{width:100%;height:42px;border:0;padding:0 12px}
        .seg{display:flex}
        .seg-btn{flex:1;height:38px;border:1px solid #e5e7eb;background:#fff}
        .seg-btn:first-child{border-radius:10px 0 0 10px}
        .seg-btn:last-child{border-radius:0 10px 10px 0}
        .seg-btn.on-in{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}
        .seg-btn.on-out{border-color:#fecdd3;background:#fff1f2;color:#9f1239}
        .form-foot{display:flex;align-items:center;justify-content:space-between;margin-top:4px}
        .chk{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#374151;cursor:pointer}
        .actions{display:flex;align-items:center;gap:8px}
        .hint{font-size:12px;color:#6b7280}
        .cta{height:38px;padding:0 14px;border-radius:10px;background:#2563eb;color:#fff;border:none}

        /* KPI */
        .kpi-row{display:flex;align-items:center;justify-content:space-between;margin:6px 0 10px}
        .kpis{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        .pill{font-size:12px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:999px;background:#fff}
        .pill.blue{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}
        .pill.red{border-color:#fecaca;background:#fff1f2;color:#b91c1c}
        .pill.dark{border-color:#e5e7eb;background:#f5f5f5;color:#111827}

        /* List as cards */
        .list .cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .item{
          background:#fff;border:1px solid #e9edf3;border-radius:14px;padding:12px;
          box-shadow:0 4px 10px rgba(15,23,42,.05)
        }
        .item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .title-wrap{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .name{font-weight:700;color:#0f172a}
        .tag{font-size:12px;color:#6b7280}
        .badge{font-size:11px;border-radius:999px;padding:2px 8px;color:#fff;background:#111827}
        .amount{font-weight:800;font-size:18px}
        .amount.in{color:#0ea5e9}
        .amount.out{color:#ef4444}
        .meta{margin-top:6px;display:flex;gap:10px;color:#6b7280;font-size:12px}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
        .item-act{margin-top:8px;display:flex;justify-content:flex-end}
        .btn-del{height:30px;padding:0 10px;border-radius:8px;border:1px solid #fecaca;background:#fff1f2;color:#9f1239}

        .empty{padding:14px;border:1px dashed #e5e7eb;border-radius:12px;text-align:center;color:#6b7280;background:#fff}

        .footer{margin-top:12px;color:#6b7280;font-size:12px;text-align:center}

        /* 작은 화면 보완 */
        @media (max-width: 420px){
          .amount{font-size:16px}
          .cal-day{height:36px}
          .input,.money>input{height:40px}
          .cta{height:36px}
        }
      `}</style>
    </div>
  );
}