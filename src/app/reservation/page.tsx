// filepath: src/app/rsv/reservation/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOwnerIdValue } from '@/shared/core/owner';
import {
    type ReservationEntry,
    useReservationListByDate,
    useInsertReservation,
    useToggleReservationStatus,
    useDeleteReservation,
} from '@/shared/reservation';

type Id = number | string;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM  = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseLocal(dt: string | null | undefined): Date | null {
    if (!dt) return null;
    const s = String(dt).replace('T', ' ').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (!m) return null;
    const Y = +m[1], Mo = +m[2] - 1, D = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0);
    return new Date(Y, Mo, D, h, mi, se);
}
const getStartMillis = (r: ReservationEntry) => {
    const d = parseLocal(r.resvStartDt ?? null);
    return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
};

const makeMonthMatrix = (year: number, month0: number) => {
    const first = new Date(year, month0, 1);
    const last  = new Date(year, month0 + 1, 0);
    const startIdx = first.getDay();
    const total = last.getDate();
    const rows: Date[][] = [];
    let day = 1 - startIdx;
    for (let r = 0; r < 6; r++) {
        const row: Date[] = [];
        for (let c = 0; c < 7; c++) row.push(new Date(year, month0, day++));
        rows.push(row);
        if (day > total && startIdx + total <= r * 7 + 6) break;
    }
    return rows;
};

export default function ReservationListPage() {
    // ── state: 날짜/그룹/소유자 ───────────────────────────────
    const today = useMemo(() => new Date(), []);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth0, setViewMonth0] = useState(today.getMonth());
    const [selected, setSelected] = useState(toYMD(today));

    const params = useSearchParams();
    const grpCd = (params.get('grpCd') ?? '').trim() || null;
    const ownerIdVal = useOwnerIdValue();
    const ownerId: number | null = typeof ownerIdVal === 'number' ? ownerIdVal : null;

    // ── inputs: 빠른 등록 ───────────────────────────────────
    const [startHm, setStartHm] = useState(toHM(new Date()));
    const [endHm, setEndHm]     = useState(toHM(new Date(Date.now() + 60 * 60 * 1000)));
    const [title, setTitle] = useState('');
    const [resourceNm, setResourceNm] = useState('');
    const [capacityCnt, setCapacityCnt] = useState<number | null>(null);

    // ── data: 목록 ──────────────────────────────────────────
    const q = useReservationListByDate({ resvDate: selected, grpCd, ownerId });
    const list = (q.data ?? []).slice().sort((a, b) => getStartMillis(a) - getStartMillis(b));

    // ── mutations ───────────────────────────────────────────
    const mInsert = useInsertReservation({ grpCd, ownerId });
    const mToggle = useToggleReservationStatus({ resvDate: selected, grpCd, ownerId });
    const mDelete = useDeleteReservation({ resvDate: selected, grpCd, ownerId });

    // ── handlers ────────────────────────────────────────────
    const moveMonth = (d: number) => {
        let m = viewMonth0 + d;
        let y = viewYear;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0;  y++; }
        setViewYear(y);
        setViewMonth0(m);
    };
    const matrix = useMemo(() => makeMonthMatrix(viewYear, viewMonth0), [viewYear, viewMonth0]);
    const isToday = (d: Date) => toYMD(d) === toYMD(today);

    const onPick = (d: Date) => setSelected(toYMD(d));
    const onToday = () => {
        const t = new Date();
        setViewYear(t.getFullYear());
        setViewMonth0(t.getMonth());
        setSelected(toYMD(t));
    };

    const submitQuick = async () => {
        const t = title.trim();
        if (!t) { alert('제목을 입력하세요.'); return; }

        const startIso = `${selected}T${(startHm || '09:00')}`;
        const endIso   = `${selected}T${(endHm || startHm || '09:00')}`;

        await mInsert.mutateAsync({
            title: t,
            resvStartDt: startIso,
            resvEndDt: endIso,
            grpCd: grpCd ?? undefined,
            ownerId: ownerId ?? undefined,
            resourceNm: resourceNm.trim() || null,
            capacityCnt: capacityCnt,
            statusCd: 'SCHEDULED',
        });

        // reset inputs
        setTitle('');
        setResourceNm('');
        setCapacityCnt(null);
    };

    const toggleStatus = async (id: Id, checked: boolean) => {
        const rid = typeof id === 'number' ? id : Number(id);
        if (!Number.isFinite(rid)) return;
        await mToggle.mutateAsync({ reservationId: rid, statusCd: checked ? 'DONE' : 'SCHEDULED' });
    };

    const removeRow = async (id: Id) => {
        if (!confirm('삭제하시겠습니까?')) return;
        const rid = typeof id === 'number' ? id : Number(id);
        if (!Number.isFinite(rid)) return;
        await mDelete.mutateAsync({ reservationId: rid });
    };

    const goModify = (id: Id) => {
        const qs = new URLSearchParams();
        qs.set('reservationId', String(id));
        if (grpCd) qs.set('grpCd', grpCd);
        location.href = `/rsv/reservation/reservationModify?${qs.toString()}`;
    };

    // ── render helpers ──────────────────────────────────────
    const badgeClass = (status?: string | null) => {
        const s = (status ?? 'SCHEDULED').toUpperCase();
        return `status-badge status-${s}`;
    };
    const rangeText = (s?: string | null, e?: string | null) => {
        const ds = parseLocal(s ?? null);
        const de = parseLocal(e ?? null);
        if (!ds && !de) return '-';
        const sh = ds ? toHM(ds) : '--:--';
        const eh = de ? toHM(de) : '--:--';
        return `${sh} ~ ${eh}`;
    };

    return (
        <div className="rsv-root">
            <div className="header">
                <div className="nav">
                    <button className="btn-icon" onClick={() => moveMonth(-1)} aria-label="이전 달">«</button>
                    <div className="month">{viewYear}. {pad(viewMonth0 + 1)}</div>
                    <button className="btn-icon" onClick={() => moveMonth(1)} aria-label="다음 달">»</button>
                </div>
                <div className="ctrl">
                    <button className="pill" onClick={onToday}>오늘</button>
                    <div className="pill pill-ghost">선택: <b>{selected}</b></div>
                </div>
            </div>

            {/* Calendar */}
            <div className="calendar-card">
                <table className="calendar">
                    <thead><tr>{['일','월','화','수','목','금','토'].map((d) => <th key={d}>{d}</th>)}</tr></thead>
                    <tbody>
                    {matrix.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((d, ci) => {
                                const inMonth = d.getMonth() === viewMonth0;
                                const sel = toYMD(d) === selected;
                                return (
                                    <td key={ci} onClick={() => onPick(d)} title={toYMD(d)}>
                                        <div
                                            className={`day ${sel ? 'is-sel' : ''} ${isToday(d) ? 'is-today' : ''} ${inMonth ? '' : 'is-other'}`}
                                        >
                                            {d.getDate()}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
                <div className="quick">
                    <div className="row">
                        <label>시작</label>
                        <input type="time" value={startHm} onChange={(e) => setStartHm(e.target.value)} />
                        <label>종료</label>
                        <input type="time" value={endHm} onChange={(e) => setEndHm(e.target.value)} />
                        <label>인원</label>
                        <input
                            type="number"
                            placeholder="예: 3"
                            value={capacityCnt ?? ''}
                            onChange={(e) => {
                                const v = e.target.value.trim();
                                if (v === '') { setCapacityCnt(null); return; }
                                const n = Number(v);
                                setCapacityCnt(Number.isFinite(n) ? n : null);
                            }}
                        />
                    </div>
                    <input
                        className="full"
                        placeholder="제목 / 약속명"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void submitQuick(); }}
                    />
                    <input
                        className="full"
                        placeholder="장소 / 상대 / 룸이름 등"
                        value={resourceNm}
                        onChange={(e) => setResourceNm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void submitQuick(); }}
                    />
                    <div className="right">
                        <button className="btn-primary" onClick={() => void submitQuick()} disabled={mInsert.isPending}>
                            {mInsert.isPending ? '등록 중…' : '등록'}
                        </button>
                    </div>
                </div>
            </div>

            {/* List: Desktop table */}
            <div className="list-card desktop-only">
                <table className="tbl">
                    <thead>
                        <tr>
                            <th style={{width:42}} />
                            <th style={{width:90, textAlign:'right'}}>번호</th>
                            <th>제목 / 장소</th>
                            <th style={{width:220}}>시간</th>
                            <th style={{width:110, textAlign:'center'}}>상태</th>
                            <th style={{width:90, textAlign:'center'}}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {q.isLoading ? (
                            <tr><td colSpan={6} className="muted">불러오는 중…</td></tr>
                        ) : list.length === 0 ? (
                            <tr><td colSpan={6} className="muted">등록된 예약이 없습니다.</td></tr>
                        ) : list.map((r) => {
                            const id = r.reservationId ?? null;
                            const checked = (r.statusCd ?? '').toUpperCase() === 'DONE';
                            return (
                                <tr key={String(id)} onClick={() => id !== null && goModify(id)}>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => id !== null && toggleStatus(id, e.currentTarget.checked)}
                                            aria-label={`항목 ${id ?? ''} 완료 여부`}
                                        />
                                    </td>
                                    <td style={{textAlign:'right'}}>{id ?? ''}</td>
                                    <td>
                                        <div className="title-cell">
                                            <div className={`title-main ${checked ? 'done' : ''}`}>{r.title ?? ''}</div>
                                            {r.resourceNm ? <div className="title-sub">{r.resourceNm}</div> : null}
                                        </div>
                                    </td>
                                    <td title={r.resvStartDt ?? ''}>{rangeText(r.resvStartDt, r.resvEndDt)}</td>
                                    <td style={{textAlign:'center'}}>
                                        <span className={badgeClass(r.statusCd)}>{(r.statusCd ?? 'SCHEDULED').toUpperCase()}</span>
                                    </td>
                                    <td style={{textAlign:'center'}} onClick={(e) => e.stopPropagation()}>
                                        <button className="btn-ghost" onClick={() => id !== null && void removeRow(id)}>삭제</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* List: Mobile cards */}
            <div className="list-card mobile-only">
                {q.isLoading ? (
                    <div className="muted m-gap">불러오는 중…</div>
                ) : list.length === 0 ? (
                    <div className="muted m-gap">등록된 예약이 없습니다.</div>
                ) : (
                    <div className="m-list">
                        {list.map((r) => {
                            const id = r.reservationId ?? null;
                            const checked = (r.statusCd ?? '').toUpperCase() === 'DONE';
                            return (
                                <div
                                    key={String(id)}
                                    className="m-item"
                                    onClick={() => id !== null && goModify(id)}
                                    role="button"
                                >
                                    <div className="m-top" onClick={(e) => e.stopPropagation()}>
                                        <div className="m-left">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => id !== null && toggleStatus(id, e.currentTarget.checked)}
                                                aria-label={`항목 ${id ?? ''} 완료 여부`}
                                            />
                                            <div className="m-num">{id ?? ''}</div>
                                        </div>
                                        <div className="m-right">
                                            <span className={badgeClass(r.statusCd)}>{(r.statusCd ?? 'SCHEDULED').toUpperCase()}</span>
                                        </div>
                                    </div>

                                    <div className={`m-title ${checked ? 'done' : ''}`}>{r.title ?? ''}</div>
                                    {r.resourceNm ? <div className="m-sub">{r.resourceNm}</div> : null}
                                    <div className="m-time">{rangeText(r.resvStartDt, r.resvEndDt)}</div>

                                    <div className="m-actions" onClick={(e) => e.stopPropagation()}>
                                        <button className="btn-ghost" onClick={() => id !== null && void removeRow(id)}>삭제</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style jsx>{`
                .rsv-root { max-width: 1140px; margin: 0 auto; padding: 16px; }
                .header { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
                .nav { display:flex; align-items:center; gap:8px; }
                .month { font-size:18px; font-weight:700; color:#0f172a; }
                .btn-icon { width:38px; height:38px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; }
                .ctrl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
                .pill { height:38px; display:inline-flex; align-items:center; padding:0 12px; border-radius:999px; border:1px solid #e5e7eb; background:#fff; }
                .pill-ghost { background:#f8fafc; }
                .btn-primary { height:38px; padding:0 14px; border-radius:10px; background:#111827; color:#fff; border:none; font-weight:700; }
                .btn-ghost { border:1px solid #e5e7eb; background:#fff; color:#374151; border-radius:8px; padding:6px 10px; }
                .btn-ghost:hover { background:#f8fafc; }

                .calendar-card { border:1px solid #e9edf3; border-radius:12px; overflow:hidden; margin-bottom:12px; background:#fff; }
                .calendar { width:100%; table-layout:fixed; border-collapse:collapse; }
                .calendar thead tr { background:#f8fafc; }
                .calendar th { padding:10px 0; font-weight:700; }
                .calendar td { height:56px; padding:0; text-align:center; border-top:1px solid #f1f3f7; vertical-align:middle; cursor:pointer; }
                .day { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:32px; padding:0 6px; border-radius:16px; user-select:none; color:#0f172a; }
                .day.is-other { opacity:.35; }
                .day.is-today { outline:1px solid #0f172a; }
                .day.is-sel { background:#111827; color:#fff; }

                .quick { padding:12px; border-top:1px solid #e9edf3; display:grid; gap:8px; }
                .quick .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
                .quick label { font-size:12px; color:#64748b; }
                .quick input[type="time"], .quick input[type="number"] { height:36px; border:1px solid #e5e7eb; border-radius:8px; padding:0 8px; }
                .quick .full { height:38px; border:1px solid #e5e7eb; border-radius:8px; padding:0 10px; width:100%; }
                .quick .right { display:flex; justify-content:flex-end; }

                .list-card { border:1px solid #e9edf3; border-radius:12px; background:#fff; }
                .tbl { width:100%; table-layout:fixed; border-collapse:collapse; }
                .tbl thead th { background:#f3f5f8; border-bottom:1px solid #e9edf3; color:#475569; font-weight:700; font-size:13px; }
                .tbl td { border-top:1px solid #f1f3f7; padding:10px; }
                .muted { text-align:center; color:#6b7280; padding:16px 0; }

                .title-cell { display:flex; flex-direction:column; gap:2px; }
                .title-main { font-weight:600; color:#0f172a; word-break:break-word; }
                .title-main.done { text-decoration:line-through; color:#9ca3af; }
                .title-sub { font-size:12px; color:#6b7280; }

                .status-badge {
                    font-size:11px; border-radius:999px; padding:2px 8px; border:1px solid #e5e7eb;
                    display:inline-block; font-weight:600; background:#fff; color:#334155;
                }
                .status-SCHEDULED { background:#eef2ff; border-color:#c7d2fe; color:#3730a3; }
                .status-PENDING   { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
                .status-APPROVED  { background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
                .status-DONE      { background:#dcfce7; border-color:#86efac; color:#065f46; }
                .status-CANCELLED { background:#fee2e2; border-color:#fecaca; color:#991b1b; }

                /* ── Responsive switching ── */
                .desktop-only { display:block; }
                .mobile-only { display:none; }
                @media (max-width: 560px){
                    .desktop-only { display:none; }
                    .mobile-only { display:block; }
                }

                /* ── Mobile list(card) styles ── */
                @media (max-width: 560px){
                    .m-gap { padding: 14px; }

                    .m-list { display: grid; gap: 10px; padding: 10px; }
                    .m-item {
                        border: 1px solid #e9edf3;
                        border-radius: 12px;
                        padding: 10px 12px;
                        background: #fff;
                    }
                    .m-top {
                        display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;
                    }
                    .m-left { display:flex; align-items:center; gap:10px; }
                    .m-num { font-weight:700; color:#0f172a; min-width: 22px; text-align:right; }
                    .m-title { font-weight:700; color:#0f172a; line-height:1.35; }
                    .m-title.done { text-decoration: line-through; color:#9ca3af; }
                    .m-sub { font-size:12px; color:#6b7280; margin-top:2px; }
                    .m-time { font-size:12px; color:#475569; margin-top:4px; }
                    .m-actions { display:flex; justify-content:flex-end; margin-top:8px; }
                }
            `}</style>
        </div>
    );
}
