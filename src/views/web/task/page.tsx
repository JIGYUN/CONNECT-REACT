/* filepath: src/app/tasks/page.tsx */
'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskListByDate, useInsertTask, useToggleTask, useDeleteTask } from '@shared/task/api/queries';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM  = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  const sp = useSearchParams();
  const grpCd = sp.get('grpCd') ?? '';

  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [viewY, setViewY] = useState(selected.getFullYear());
  const [viewM0, setViewM0] = useState(selected.getMonth());
  const [time, setTime] = useState(toHM(now));
  const titleRef = useRef<HTMLInputElement>(null);

  const dateStr = toYMD(selected);
  const listParams = useMemo(() => ({ grpCd, dueDate: dateStr }), [grpCd, dateStr]);

  // queries
  const q       = useTaskListByDate(listParams);
  const insert  = useInsertTask({ grpCd });
  const toggle  = useToggleTask({});
  const del     = useDeleteTask({});

  const matrix = useMemo(() => monthMatrix(viewY, viewM0), [viewY, viewM0]);

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
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      {/* 헤더 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between', marginBottom:12}}>
        <h2 style={{margin:0}}>Tasks</h2>
        <span style={{fontSize:12, padding:'4px 10px', border:'1px solid #e9edf3', borderRadius:999}}>
          grpCd: <b>{grpCd || '개인'}</b>
        </span>
      </div>

      {/* 캘린더 + 퀵추가 */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start', marginBottom:16}}>
        {/* 캘린더 */}
        <div style={{background:'#fff', border:'1px solid #e9edf3', borderRadius:16, boxShadow:'0 6px 16px rgba(15,23,42,.05)', padding:16}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
            <button onClick={() => moveMonth(-1)} style={{appearance:'none', border:'1px solid #e9edf3', borderRadius:8, padding:'4px 8px', background:'#fff'}}>{'«'}</button>
            <div style={{fontWeight:800, letterSpacing:.3, marginRight:'auto'}}>{viewY}년 {pad(viewM0+1)}월</div>
            <button onClick={() => moveMonth(1)} style={{appearance:'none', border:'1px solid #e9edf3', borderRadius:8, padding:'4px 8px', background:'#fff'}}>{'»'}</button>
            <button
              onClick={() => { const t=new Date(); setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate())); setViewY(t.getFullYear()); setViewM0(t.getMonth()); }}
              style={{appearance:'none', border:'1px solid #e9edf3', borderRadius:8, padding:'4px 10px', background:'#fff'}}
            >오늘</button>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6}}>
            {['일','월','화','수','목','금','토'].map(w => (
              <div key={w} style={{textAlign:'center', fontSize:12, color:'#64748b', fontWeight:700, padding:'6px 0', border:'1px solid #e9edf3', borderRadius:10, background:'#fff'}}>{w}</div>
            ))}
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, background:'#fff', border:'1px solid #e9edf3', borderRadius:12, padding:12, minHeight:264}}>
            {matrix.flat().map((d, i) => {
              const inMonth = d.getMonth() === viewM0;
              const today = new Date(); today.setHours(0,0,0,0);
              const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const isToday = d0.getTime() === today.getTime();
              const isSel = d0.getTime() === new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    appearance:'none', border:'1px solid #e9edf3', borderRadius:10, height:40,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', userSelect:'none', fontWeight:600,
                    color: '#334155', opacity: inMonth ? 1 : .35,
                    background: isSel ? '#e0ecff' : '#fff',
                    boxShadow: isToday ? '0 0 0 2px #dbeafe inset' : undefined
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Add */}
        <div style={{background:'#fff', border:'1px solid #e9edf3', borderRadius:16, boxShadow:'0 6px 16px rgba(15,23,42,.05)', padding:16}}>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{maxWidth:140}} />
            <input ref={titleRef} type="search" placeholder="할 일을 입력하고 Enter" style={{flex:1}} onKeyDown={e => { if (e.key === 'Enter') onAdd(); }} />
            <button onClick={onAdd} disabled={insert.isPending}>추가</button>
          </div>
          <div style={{color:'#6b7280', fontSize:12}}>선택한 날짜 + 시간으로 저장됩니다.</div>
        </div>
      </div>

      {/* 목록 */}
      <div style={{background:'#fff', border:'1px solid #e9edf3', borderRadius:16, boxShadow:'0 6px 16px rgba(15,23,42,.05)', padding:0}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
          <tr style={{background:'#f3f5f8', color:'#475569'}}>
            <th style={{width:42, padding:'10px 8px'}}></th>
            <th style={{width:90, padding:'10px 8px', textAlign:'right'}}>번호</th>
            <th style={{padding:'10px 8px', textAlign:'left'}}>제목</th>
            <th style={{width:220, padding:'10px 8px', textAlign:'left'}}>기한</th>
            <th style={{width:100, padding:'10px 8px', textAlign:'center'}}>관리</th>
          </tr>
          </thead>
          <tbody>
          {q.isLoading && (
            <tr><td colSpan={5} style={{padding:16, textAlign:'center', color:'#6b7280'}}>불러오는 중…</td></tr>
          )}

          {!q.isLoading && !q.isFetching && (q.data?.length ?? 0) === 0 && (
            <tr><td colSpan={5} style={{padding:24, textAlign:'center', color:'#6b7280'}}>등록된 데이터가 없습니다.</td></tr>
          )}

          {q.data?.map(r => {
            const checked = String(r.statusCd).toUpperCase() === 'DONE';
            const due = formatHM(r.dueDt);
            return (
              <tr key={r.taskId} style={{cursor:'pointer'}}>
                <td style={{padding:'10px 8px', textAlign:'center'}} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={checked} onChange={e => toggleRow(r.taskId, e.target.checked)} />
                </td>
                <td style={{padding:'10px 8px', textAlign:'right'}}>{r.taskId}</td>
                <td style={{padding:'10px 8px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{fontWeight:600, color: checked ? '#9ca3af' : '#0f172a', textDecoration: checked ? 'line-through' : undefined}}>
                      {r.title ?? '(제목 없음)'}
                    </div>
                    <span style={{
                      marginLeft:4, fontSize:11, borderRadius:999, padding:'2px 8px',
                      border:'1px solid #e9edf3',
                      color: checked ? '#065f46' : '#3730a3',
                      background: checked ? '#ecfdf5' : '#eef2ff'
                    }}>
                      {checked ? '완료' : '진행중'}
                    </span>
                  </div>
                </td>
                <td style={{padding:'10px 8px'}} title={fullDateTime(r.dueDt)}>{due}</td>
                <td style={{padding:'10px 8px', textAlign:'center'}} onClick={e => e.stopPropagation()}>
                  <button onClick={() => deleteRow(r.taskId)} disabled={del.isPending}>삭제</button>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      <div style={{marginTop:12, color:'#6b7280', fontSize:12}}>CONNECT · v1</div>
    </div>
  );
}

function parseLocal(dts?: string | null) {
  if (!dts) return null;
  const s = String(dts).replace('T', ' ');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return null;
  const Y = +m[1], Mo = +m[2] - 1, D = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0);
  return new Date(Y, Mo, D, h, mi, se);
}
function formatHM(dts?: string | null) {
  const d = parseLocal(dts); if (!d) return '-';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fullDateTime(dts?: string | null) {
  const d = parseLocal(dts); if (!d) return '';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}