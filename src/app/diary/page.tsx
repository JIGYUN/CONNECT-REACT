// filepath: src/app/diary/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDiaryByDate, useUpsertDiary } from '@/shared/diary/api/queries';
import type { DiaryEntry, DiaryUpsertInput } from '@/shared/diary/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useOwnerIdValue } from '@/shared/core/owner';

const PAGE_MAX_WIDTH = 1140;
const MIN_EDITOR_HEIGHT = 420;
const CAL_ROW_H = 56;
const DAY_H = 32;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function makeMonthMatrix(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
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
}

/* ───────────── CKEditor upload adapter ───────────── */
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

class UploadAdapter {
  loader: { file: Promise<File> };
  constructor(loader: { file: Promise<File> }) { this.loader = loader; }
  async upload() {
    const file = await this.loader.file;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/common/file/upload', { method: 'POST', body: fd });
    const ct = (res.headers.get('content-type') || '').toLowerCase();

    let url = '';
    if (ct.includes('application/json')) {
      const j = (await res.json()) as unknown;
      if (isRec(j) && typeof j['url'] === 'string') url = j['url'];
      if (!url && isRec(j) && typeof j['fileUrl'] === 'string') url = j['fileUrl'];
      const r = isRec(j) && isRec(j['result']) ? j['result'] : null;
      if (!url && r && typeof r['url'] === 'string') url = r['url'];
      if (!url && r && typeof r['fileUrl'] === 'string') url = r['fileUrl'];
    } else {
      url = await res.text();
    }
    if (!url) throw new Error('no url');
    return { default: url };
  }
  abort() {}
}

function CustomUploadAdapterPlugin(editor: {
  plugins: { get(name: string): { createUploadAdapter?: (loader: { file: Promise<File> }) => unknown } };
}) {
  const repo = editor.plugins.get('FileRepository');
  repo.createUploadAdapter = (loader: { file: Promise<File> }) => new UploadAdapter(loader);
}

type CKEditorLike = {
  getData(): string;
  setData(s: string): void;
  editing: {
    view: {
      document: { getRoot(): unknown };
      change(cb: (writer: { setStyle: (prop: string, val: string, element: unknown) => void }) => void): void;
    };
  };
};

type CKEditorProps = {
  editor: unknown;
  data?: string;
  onChange?: (evt: unknown, editor: CKEditorLike) => void;
  onReady?: (editor: unknown) => void;
  config?: unknown;
};
type CKEditorComponent = ComponentType<CKEditorProps>;

function pickHtmlSafe(v: DiaryEntry | null | undefined): string {
  if (!v) return '';
  return (typeof v.content === 'string' && v.content)
      || (typeof v.body === 'string' && v.body)
      || '';
}

/* ───────────── Page ───────────── */
export default function DiaryPage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth0, setViewMonth0] = useState(today.getMonth());
  const [selected, setSelected] = useState(toYMD(today));

  const searchParams = useSearchParams();
  const grpCdParam = searchParams.get('grpCd') ?? undefined;
  const grpCd: string | null = grpCdParam ?? null;

  const ownerIdParam = useOwnerIdValue() ?? undefined;
  const ownerId: number | null = ownerIdParam ?? null;

  const q: UseQueryResult<DiaryEntry | null, Error> = useDiaryByDate({
    diaryDt: selected,
    grpCd,
    ownerId,
  });

  const upsert: UseMutationResult<void, Error, DiaryUpsertInput, unknown> =
    useUpsertDiary({ grpCd, ownerId });

  const isBusy = q.isLoading || q.isFetching;

  // CKEditor dynamic import
  const [CKE, setCKE] = useState<null | { CKEditor: CKEditorComponent; ClassicEditor: unknown }>(null);
  const editorRef = useRef<CKEditorLike | null>(null);
  const settingByCode = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const m = await import('@ckeditor/ckeditor5-react');
      const CKEditor = (m as unknown as { CKEditor: CKEditorComponent }).CKEditor;
      const ClassicEditor = (await import('@ckeditor/ckeditor5-build-classic')).default as unknown;
      if (mounted) setCKE({ CKEditor, ClassicEditor });
    })();
    return () => { mounted = false; };
  }, []);

  // 서버 값 → 에디터 동기화
  const [content, setContent] = useState('');
  useEffect(() => {
    if (isBusy) return;
    setContent(pickHtmlSafe(q.data));
  }, [isBusy, q.data, selected]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = ed.getData() ?? '';
    if (cur !== content) {
      settingByCode.current = true;
      ed.setData(content || '');
      setTimeout(() => { settingByCode.current = false; }, 0);
    }
  }, [content]);

  const onSave = async () => {
    const body: DiaryUpsertInput = { diaryDt: selected, content: content || '', grpCd, ownerId };
    await upsert.mutateAsync(body);
    alert('저장되었습니다.');
  };

  const matrix = useMemo(() => makeMonthMatrix(viewYear, viewMonth0), [viewYear, viewMonth0]);
  const moveMonth = (d: number) => {
    let m = viewMonth0 + d, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewYear(y); setViewMonth0(m);
  };
  const pick = (d: Date) => setSelected(toYMD(d));

  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth0(t.getMonth());
    setSelected(toYMD(t));
  };

  return (
    <div className="diary-root" style={{ maxWidth: PAGE_MAX_WIDTH, margin: '0 auto', padding: 16 }}>
      {/* 헤더 */}
      <div className="header">
        <div className="nav">
          <button className="btn-icon" onClick={() => moveMonth(-1)} aria-label="이전 달">«</button>
          <div className="month">{viewYear}. {pad(viewMonth0 + 1)}</div>
          <button className="btn-icon" onClick={() => moveMonth(1)} aria-label="다음 달">»</button>
        </div>

        <div className="ctrl">
          <button className="pill" onClick={goToday}>오늘</button>
          <div className="pill pill-ghost">선택: <b>{selected}</b></div>
          <button className="btn-primary" onClick={onSave} disabled={upsert.isPending}>
            {upsert.isPending ? '저장중…' : '저장'}
          </button>
        </div>
      </div>

      {/* 달력 */}
      <div className="calendar-wrap" style={{ border: '1px solid #e9edf3', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <table className="diary-calendar">
          <thead><tr>{['일','월','화','수','목','금','토'].map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              {row.map((d, ci) => {
                const inMonth = d.getMonth() === viewMonth0;
                const dayStr = toYMD(d);
                const isSel = dayStr === selected;
                const isToday = toYMD(d) === toYMD(today);
                return (
                  <td key={ci} title={dayStr} onClick={() => pick(d)}>
                    <div
                      className="day"
                      style={{
                        background: isSel ? '#111827' : undefined,
                        color: isSel ? '#fff' : isToday ? '#111827' : inMonth ? '#0f172a' : '#9aa4b2',
                        border: !isSel && isToday ? '1px solid #111827' : undefined,
                      }}
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
      </div>

      {/* 로딩 배지 */}
      {isBusy && (
        <div className="loadingPill">
          <span className="dot" />
          불러오는 중…
        </div>
      )}

      {/* CKEditor */}
      <div className="editorCard" style={{ border: '1px solid #e9edf3', borderRadius: 12, padding: 12, background: '#fff' }}>
        {CKE ? (
          <CKE.CKEditor
            key={`diary-${selected}`}
            editor={CKE.ClassicEditor}
            data={content}
            onChange={(_evt, editor) => {
              if (settingByCode.current) return;
              setContent(editor.getData());
            }}
            onReady={(editor) => {
              const ed = editor as CKEditorLike;
              editorRef.current = ed;
              const view = ed.editing.view;
              const root = view.document.getRoot();
              view.change((writer) => { writer.setStyle('min-height', `${MIN_EDITOR_HEIGHT}px`, root); });
              if (content && ed.getData() !== content) {
                settingByCode.current = true;
                ed.setData(content);
                setTimeout(() => { settingByCode.current = false; }, 0);
              }
            }}
            config={{ placeholder: '오늘의 일기를 작성하세요…', extraPlugins: [CustomUploadAdapterPlugin] }}
          />
        ) : (
          <div style={{ padding: 12, color: '#6b7280' }}>에디터 로딩 중…</div>
        )}
        <div className="hint">이미지는 에디터의 이미지 버튼/붙여넣기로 업로드됩니다.</div>
      </div>

      <style jsx>{`
        .header{
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; flex-wrap:wrap; margin-bottom:12px;
        }
        .nav{ display:flex; align-items:center; gap:8px; }
        .month{ font-size:18px; font-weight:700; color:#0f172a; }
        .btn-icon{
          width:38px; height:38px; border-radius:10px; border:1px solid #e5e7eb;
          background:#fff; line-height:38px; text-align:center;
        }
        .ctrl{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .pill{
          height:38px; display:inline-flex; align-items:center; gap:6px;
          padding:0 12px; border-radius:999px; border:1px solid #e5e7eb;
          background:#fff; color:#111827; font-size:14px;
        }
        .pill-ghost{ background:#f8fafc; }
        .btn-primary{
          height:38px; padding:0 14px; border-radius:10px; background:#111827;
          color:#fff; font-weight:700; border:none;
        }
        .btn-primary[disabled]{ opacity:.6; }

        @media (max-width: 560px){
          .ctrl{ width:100%; justify-content:flex-end; }
          .pill-ghost{ flex:1; min-width:220px; justify-content:center; }
        }

        .diary-calendar { width: 100%; table-layout: fixed; border-collapse: collapse; }
        .diary-calendar thead tr { background: #f8fafc; color: #0f172a; }
        .diary-calendar th { padding: 10px 0; font-weight: 700; }
        .diary-calendar td { height: ${CAL_ROW_H}px !important; padding: 0; text-align: center; border-top: 1px solid #f1f3f7; vertical-align: middle; cursor: pointer; }
        .diary-calendar td .day { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: ${DAY_H}px; line-height: ${DAY_H}px; padding: 0 6px; border-radius: 16px; user-select: none; }

        .loadingPill{
          display:inline-flex; align-items:center; gap:6px; padding:6px 10px;
          border:1px solid #e5e7eb; border-radius:999px; background:#f8fafc; color:#374151; font-size:12px; margin-bottom:8px;
        }
        .loadingPill .dot{ width:8px; height:8px; border-radius:999px; box-shadow:0 0 0 2px rgba(96,165,250,.25); background:#60a5fa; }

        .hint{ margin-top:8px; color:#6b7280; font-size:12px; }
      `}</style>

      <style jsx global>{`
        .ck-editor { width: 100%; }
        .ck-editor__editable_inline { min-height: ${MIN_EDITOR_HEIGHT}px; }
        .ck.ck-editor__main > .ck-editor__editable { padding: 16px 18px; }
        .ck-content { min-height: ${MIN_EDITOR_HEIGHT}px; }
      `}</style>
    </div>
  );
}
