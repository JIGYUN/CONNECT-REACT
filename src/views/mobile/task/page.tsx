/* filepath: src/app/tasks/page.tsx */
'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useTaskListByDate,
  useInsertTask,
  useToggleTask,
  useDeleteTask,
} from '@shared/task/api/queries';

/* ===== date utils ===== */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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

export default function TasksPage() {
  const OWNER_ID = 1;

  const sp = useSearchParams();
  const grpCd = sp.get('grpCd') ?? '';

  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(
    new Date(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [viewY, setViewY] = useState(selected.getFullYear());
  const [viewM0, setViewM0] = useState(selected.getMonth());
  const [time, setTime] = useState(toHM(now));
  const titleRef = useRef<HTMLInputElement>(null);

  const dateStr = toYMD(selected);
  const listParams = useMemo(
    () => ({ grpCd, dueDate: dateStr, ownerId: OWNER_ID }),
    [grpCd, dateStr]
  );

  // queries
  const q = useTaskListByDate(listParams);
  const insert = useInsertTask({ grpCd, ownerId: OWNER_ID });
  const toggle = useToggleTask({ ownerId: OWNER_ID });
  const del = useDeleteTask({ ownerId: OWNER_ID });

  const matrix = useMemo(() => monthMatrix(viewY, viewM0), [viewY, viewM0]);

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

  const onAdd = async () => {
    const v = titleRef.current?.value?.trim();
    if (!v) return;
    const dueDt = `${toYMD(selected)}T${time}`;
    try {
      await insert.mutateAsync({ title: v, dueDt, grpCd: grpCd || null });
      if (titleRef.current) titleRef.current.value = '';
    } catch (e: any) {
      alert(e?.message ?? '등록 실패');
    }
  };

  const toggleRow = async (id: number, checked: boolean) => {
    try {
      await toggle.mutateAsync({ taskId: id, statusCd: checked ? 'DONE' : 'TODO' });
    } catch (e: any) {
      alert(e?.message ?? '상태 변경 실패');
    }
  };

  const deleteRow = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await del.mutateAsync({ taskId: id });
    } catch (e: any) {
      alert(e?.message ?? '삭제 실패');
    }
  };

  return (
    <div className="wrap">
      {/* 헤더 */}
      <div className="head">
        <h2>Tasks</h2>
        <span className="chip">
          grpCd: <b>{grpCd || '개인'}</b>
        </span>
      </div>

      {/* 캘린더 */}
      <div className="calendar-card card">
        <div className="cal-head">
          <button onClick={() => moveMonth(-1)}>{'«'}</button>
          <div className="cal-title">
            {viewY}년 {pad(viewM0 + 1)}월
          </div>
          <button onClick={() => moveMonth(1)}>{'»'}</button>
          <button
            onClick={() => {
              const t = new Date();
              setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
              setViewY(t.getFullYear());
              setViewM0(t.getMonth());
            }}
          >
            오늘
          </button>
        </div>

        <div className="cal-week">
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <div key={w} className="cal-weekcell">
              {w}
            </div>
          ))}
        </div>

        <div className="cal-grid">
          {matrix.flat().map((d, i) => {
            const inMonth = d.getMonth() === viewM0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = d0.getTime() === today.getTime();
            const isSel =
              d0.getTime() ===
              new Date(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
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
      </div>

      {/* 빠른 추가 */}
      <div className="qa-card card">
        <div className="qa-grid">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="time"
          />
          <input
            ref={titleRef}
            type="search"
            placeholder="할 일을 입력하고 Enter"
            className="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
            }}
          />
          <button onClick={onAdd} disabled={insert.isPending} className="cta">
            추가
          </button>
        </div>
        <div className="muted">선택한 날짜 + 시간으로 저장됩니다.</div>
      </div>

      {/* 목록 */}
      <div className="card list-card">
        {/* Desktop table */}
        <div className="list-desktop">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 42 }} />
                <th style={{ width: 90, textAlign: 'right' }}>번호</th>
                <th>제목</th>
                <th style={{ width: 220, textAlign: 'left' }}>기한</th>
                <th style={{ width: 100, textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={5} className="empty">
                    불러오는 중…
                  </td>
                </tr>
              )}

              {!q.isLoading && !q.isFetching && (q.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    등록된 데이터가 없습니다.
                  </td>
                </tr>
              )}

              {q.data?.map((r) => {
                const checked = String(r.statusCd).toUpperCase() === 'DONE';
                const due = formatHM(r.dueDt);
                return (
                  <tr key={r.taskId}>
                    <td className="cell-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleRow(r.taskId, e.target.checked)}
                      />
                    </td>
                    <td className="cell-right">{r.taskId}</td>
                    <td>
                      <div className="title">
                        <div
                          className="ttl"
                          style={{
                            color: checked ? '#9ca3af' : '#0f172a',
                            textDecoration: checked ? 'line-through' : undefined,
                          }}
                        >
                          {r.title ?? '(제목 없음)'}
                        </div>
                        <span className={`stat ${checked ? 'done' : 'doing'}`}>
                          {checked ? '완료' : '진행중'}
                        </span>
                      </div>
                    </td>
                    <td title={fullDateTime(r.dueDt)}>{due}</td>
                    <td className="cell-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => deleteRow(r.taskId)}
                        disabled={del.isPending}
                        className="btn-del"
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

        {/* Mobile cards */}
        <ul className="list-mobile">
          {q.isLoading && <li className="card-empty">불러오는 중…</li>}
          {!q.isLoading && !q.isFetching && (q.data?.length ?? 0) === 0 && (
            <li className="card-empty">등록된 데이터가 없습니다.</li>
          )}
          {q.data?.map((r) => {
            const checked = String(r.statusCd).toUpperCase() === 'DONE';
            const due = formatHM(r.dueDt);
            return (
              <li key={r.taskId} className="item">
                <div className="row1">
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleRow(r.taskId, e.target.checked)}
                    />
                  </label>
                  <div
                    className="it-title"
                    style={{
                      color: checked ? '#9ca3af' : '#0f172a',
                      textDecoration: checked ? 'line-through' : undefined,
                    }}
                  >
                    {r.title ?? '(제목 없음)'}
                  </div>
                  <span className={`badge ${checked ? 'done' : 'doing'}`}>
                    {checked ? '완료' : '진행중'}
                  </span>
                </div>
                <div className="row2">
                  <span className="id">#{r.taskId}</span>
                  <span className="due" title={fullDateTime(r.dueDt)}>
                    {due}
                  </span>
                  <button
                    onClick={() => deleteRow(r.taskId)}
                    disabled={del.isPending}
                    className="btn-del-sm"
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="footer">CONNECT · v1</div>

      {/* ===== styles ===== */}
      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        .wrap { max-width: 1024px; margin: 0 auto; padding: 16px; }

        .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .head h2 { margin:0; }
        .chip{font-size:12px; padding:4px 10px; border:1px solid #e9edf3; border-radius:999px}

        .card {
          background:#fff; border:1px solid #e9edf3; border-radius:16px;
          box-shadow:0 6px 16px rgba(15,23,42,.05); padding:16px;
        }

        /* calendar */
        .calendar-card { max-width: 420px; margin: 0 auto 16px; }
        .cal-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .cal-head button { appearance:none; border:1px solid #e9edf3; border-radius:8px; padding:4px 8px; background:#fff; }
        .cal-title { font-weight:800; letter-spacing:.3px; margin-right:auto; }
        .cal-week { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:6px; }
        .cal-weekcell {
          text-align:center; font-size:12px; color:#64748b; font-weight:700;
          padding:6px 0; border:1px solid #e9edf3; border-radius:10px; background:#fff;
        }
        .cal-grid {
          display:grid; grid-template-columns:repeat(7,1fr); gap:6px;
          background:#fff; border:1px solid #e9edf3; border-radius:12px; padding:12px;
        }
        .cal-day {
          appearance:none; border:1px solid #e9edf3; border-radius:10px; height:40px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; user-select:none; font-weight:600; color:#334155; background:#fff;
        }
        .cal-day.is-dim { opacity:.35; }
        .cal-day.is-sel { background:#e0ecff; }
        .cal-day.is-today { box-shadow: inset 0 0 0 2px #dbeafe; }

        /* quick add (모바일 우선) */
        .qa-card { max-width: 520px; margin: 0 auto 16px; }
        .qa-grid { display:grid; grid-template-columns: 1fr; gap:8px; width:100%; }
        .time, .search { height:36px; width:100%; }
        .cta { height:36px; width:100%; padding:0 12px; border-radius:8px; background:#2563eb; color:#fff; border:none; }
        .muted { color:#6b7280; font-size:12px; margin-top:6px; }

        /* >=520px 에서 가로 배치 */
        @media (min-width: 520px) {
          .qa-grid { grid-template-columns: 120px minmax(0,1fr) 72px; }
          .cta { width:auto; }
        }

        /* list */
        .list-card { max-width: 720px; margin: 0 auto; }

        /* Desktop table */
        .tbl { width:100%; border-collapse:collapse; }
        .tbl thead tr { background:#f3f5f8; color:#475569; }
        .tbl th, .tbl td { padding:10px 8px; border-top:1px solid #eef2f6; }
        .empty { padding:16px; text-align:center; color:#6b7280; }
        .cell-center { text-align:center; }
        .cell-right { text-align:right; }
        .title { display:flex; align-items:center; gap:8px; }
        .stat { margin-left:4px; font-size:11px; border-radius:999px; padding:2px 8px; border:1px solid #e9edf3; }
        .stat.doing { color:#3730a3; background:#eef2ff; }
        .stat.done  { color:#065f46; background:#ecfdf5; }
        .btn-del { height:30px; padding:0 10px; border-radius:8px; border:1px solid #fecaca; background:#fff1f2; color:#9f1239; }

        /* Mobile cards (기본 감춤, 모바일에서만 표시) */
        .list-mobile { display:none; list-style:none; padding:0; margin:0; }
        .item { padding:12px; border-top:1px solid #eef2f6; }
        .row1 { display:flex; align-items:center; gap:8px; }
        .chk { display:inline-flex; align-items:center; }
        .it-title { flex:1; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .badge { font-size:11px; border-radius:999px; padding:2px 8px; border:1px solid #e9edf3; }
        .badge.doing { color:#3730a3; background:#eef2ff; }
        .badge.done  { color:#065f46; background:#ecfdf5; }
        .row2 { display:flex; align-items:center; justify-content:space-between; margin-top:6px; color:#475569; font-size:13px; }
        .id { opacity:.7; }
        .due { font-weight:600; }
        .btn-del-sm { height:28px; padding:0 10px; border-radius:8px; border:1px solid #fecaca; background:#fff1f2; color:#9f1239; }

        .footer { margin-top:12px; color:#6b7280; font-size:12px; text-align:left; }

        /* 반응형 전환 */
        @media (max-width: 720px) {
          .list-desktop { display:none; }
          .list-mobile  { display:block; }
        }
      `}</style>
    </div>
  );
}

/* ===== local formatters ===== */
function parseLocal(dts?: string | null) {
  if (!dts) return null;
  const s = String(dts).replace('T', ' ');
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return null;
  const Y = +m[1],
    Mo = +m[2] - 1,
    D = +m[3],
    h = +(m[4] || 0),
    mi = +(m[5] || 0),
    se = +(m[6] || 0);
  return new Date(Y, Mo, D, h, mi, se);
}
function formatHM(dts?: string | null) {
  const d = parseLocal(dts);
  if (!d) return '-';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fullDateTime(dts?: string | null) {
  const d = parseLocal(dts);
  if (!d) return '';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}