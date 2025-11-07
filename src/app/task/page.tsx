// filepath: src/app/task/page.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  useTaskListByDate,
  useInsertTask,
  useToggleTask,
  useDeleteTask,
} from '@shared/task/api/queries';
import type { Task } from '@shared/task/types';

/* ───────────────────────── UI: 로딩 스켈레톤 ───────────────────────── */
const Loading = () => (
  <div className="wrap mx-auto max-w-[720px] p-4">
    <div className="mb-3 h-6 w-40 rounded bg-gray-200" />
    <div className="mb-4 h-48 rounded-xl bg-gray-200" />
    <div className="space-y-2 rounded-xl bg-gray-100 p-3">
      <div className="h-6 rounded bg-gray-200" />
      <div className="h-6 rounded bg-gray-200" />
      <div className="h-6 rounded bg-gray-200" />
    </div>
  </div>
);

/* ───────────────────────── helpers ───────────────────────── */
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isSameMonth = (d: Date, y: number, m0: number) => d.getFullYear() === y && d.getMonth() === m0;

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

function parseLocal(dts?: string | null) {
  if (!dts) return null;
  const s = String(dts).replace('T', ' ');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(s);
  if (!m) return null;
  const [, Ys, Mos, Ds, hs = '0', mis = '0', ses = '0'] = m;
  const Y = Number(Ys);
  const Mo = Number(Mos) - 1;
  const D = Number(Ds);
  const h = Number(hs) | 0;
  const mi = Number(mis) | 0;
  const se = Number(ses) | 0;
  return new Date(Y, Mo, D, h, mi, se);
}
function formatHM(dts?: string | null) {
  const d = parseLocal(dts);
  if (!d) return null;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function normalizeHM(hm: string): string {
  const m = /^(\d{1,2}):(\d{1,2})/.exec(hm || '');
  const [, h = '0', mm_ = '0'] = m ?? [];
  const hh = pad(Number(h) | 0);
  const mm = pad(Number(mm_) | 0);
  return `${hh}:${mm}`;
}
function cryptoRandomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
function msg(e: unknown, fb: string) {
  return e instanceof Error ? e.message : fb;
}

/* ───────────────────────── UI 모델 ───────────────────────── */
type UiTask = {
  id: number | string;
  title: string;
  statusCd: 'TODO' | 'DOING' | 'DONE' | string;
  dueDt?: string | null;
  dueHm?: string | null;
};
function toUiTask(t: Pick<Task, 'taskId' | 'title' | 'statusCd' | 'dueDt'>): UiTask {
  const id: number | string = typeof t.taskId === 'number' ? t.taskId : cryptoRandomId();
  const title: string = t.title ?? '(제목 없음)';
  const dueDt = t.dueDt ?? null;
  return { id, title, statusCd: t.statusCd, dueDt, dueHm: formatHM(dueDt) };
}

/* ───────────────────────── Page(모바일 전용) ───────────────────────── */
function TasksPage() {
  const OWNER_ID = 1 as const;

  const sp = useSearchParams();
  const grpCd = useMemo(() => {
    const g = sp.get('grpCd');
    return g && g.trim() ? g : null;
  }, [sp]);

  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [viewY, setViewY] = useState(selected.getFullYear());
  const [viewM0, setViewM0] = useState(selected.getMonth());
  const [time, setTime] = useState(toHM(now));
  const titleRef = useRef<HTMLInputElement>(null);

  const dateStr = toYMD(selected);
  const listParams = useMemo(() => ({ dueDate: dateStr, grpCd, ownerId: OWNER_ID }), [dateStr, grpCd]);

  // 쿼리/뮤테이션
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
    const hm = normalizeHM(time);
    const dueDt = `${toYMD(selected)}T${hm}`;
    try {
      await insert.mutateAsync({ title: v, dueDt, grpCd });
      if (titleRef.current) titleRef.current.value = '';
    } catch (e: unknown) {
      alert(msg(e, '등록 실패'));
    }
  };

  const toNumberId = (id: UiTask['id']): number | null => {
    if (typeof id === 'number') return Number.isFinite(id) ? id : null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  };

  const toggleRow = async (id: UiTask['id'], checked: boolean) => {
    try {
      const n = toNumberId(id);
      if (n == null) {
        alert('아직 저장되지 않은 항목입니다.');
        return;
      }
      await toggle.mutateAsync({ taskId: n, statusCd: checked ? 'DONE' : 'TODO' });
    } catch (e: unknown) {
      alert(msg(e, '상태 변경 실패'));
    }
  };

  const deleteRow = async (id: UiTask['id']) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const n = toNumberId(id);
      if (n == null) {
        alert('아직 저장되지 않은 항목입니다.');
        return;
      }
      await del.mutateAsync({ taskId: n });
    } catch (e: unknown) {
      alert(msg(e, '삭제 실패'));
    }
  };

  const items: UiTask[] = useMemo(() => (q.data ?? []).map(toUiTask), [q.data]);

  return (
    <div className="wrap mx-auto max-w-[720px] p-4 overflow-x-hidden">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-base font-semibold">Tasks</h1>
        <span className="text-xs text-slate-500">{dateStr}</span>
      </div>

      {/* 달력 */}
      <div className="mb-4 overflow-hidden rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => moveMonth(-1)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          >
            ‹
          </button>
          <div className="text-sm font-medium">
            {viewY}.{pad(viewM0 + 1)}
          </div>
          <button onClick={() => moveMonth(1)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
            ›
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-slate-500">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {matrix.flat().map((d, i) => {
            const inMonth = isSameMonth(d, viewY, viewM0);
            const isSel = isSameDate(d, selected);
            const isToday = isSameDate(d, new Date());
            const base = 'relative select-none rounded-md py-2 text-sm cursor-pointer transition';
            const tone = inMonth ? 'text-slate-800' : 'text-slate-400';
            const sel = isSel ? 'ring-2 ring-black font-semibold' : '';
            const todayBadge = isToday
              ? 'after:absolute after:-top-1.5 after:right-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-black'
              : '';
            return (
              <div
                key={i}
                onClick={() => pick(d)}
                className={`${base} ${tone} ${sel} ${todayBadge} hover:bg-slate-50`}
              >
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 입력줄 — 갤폴드5에서 가로 넘침 방지 (min-w-0 + 더 좁은 time 폭) */}
      <div className="mb-3 flex items-center gap-2">
        <input
          ref={titleRef}
          type="text"
          placeholder="할 일을 입력"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onAdd();
          }}
        />
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          type="time"
          className="h-10 w-24 sm:w-[110px] rounded-lg border border-slate-200 px-2 text-sm"
        />
        <button
          onClick={onAdd}
          className="inline-flex h-10 min-w-[56px] items-center justify-center rounded-lg bg-black px-3 text-sm text-white whitespace-nowrap"
          aria-label="할 일 추가"
        >
          추가
        </button>
      </div>

      {/* 목록 */}
      <div className="rounded-xl bg-white p-2 shadow-sm">
        {q.isLoading ? (
          <div className="text-sm text-slate-500">로딩 중…</div>
        ) : items.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.statusCd === 'DONE'}
                    onChange={(e) => void toggleRow(r.id, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className={`text-sm ${r.statusCd === 'DONE' ? 'line-through text-slate-400' : ''}`}>
                    {r.title}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{r.dueHm ?? ''}</span>
                  <button onClick={() => void deleteRow(r.id)} className="text-xs text-red-500">
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">할 일이 없습니다.</div>
        )}
      </div>

      <style jsx>{`
        /* 브라우저별 time 인풋 높이 불일치 완화 */
        input[type='time']::-webkit-date-and-time-value {
          min-height: 0;
        }
        input[type='time'] {
          line-height: normal;
        }
      `}</style>
    </div>
  );
}

// SSR off (미스매치 방지)
export default dynamic(() => Promise.resolve(TasksPage), { ssr: false, loading: Loading });
