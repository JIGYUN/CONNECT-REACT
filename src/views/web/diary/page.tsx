/* filepath: src/app/diary/page.tsx */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDiaryByDate, useUpsertDiary } from '@shared/diary';

// ===== 화면 사이즈/치수 =====
const PAGE_MAX_WIDTH = 1140;
const MIN_EDITOR_HEIGHT = 420;
const CAL_ROW_H = 56;
const DAY_H = 32;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 달력 행렬
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

/** CKEditor 업로드 어댑터 */
class UploadAdapter {
  loader: any;
  constructor(loader: any) {
    this.loader = loader;
  }
  async upload() {
    const file = await this.loader.file;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/common/file/upload', { method: 'POST', body: fd });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let url = '';
    if (ct.includes('application/json')) {
      const j = await res.json();
      url = j?.url || j?.fileUrl || j?.result?.url || j?.result?.fileUrl || '';
    } else {
      url = await res.text();
    }
    if (!url) throw new Error('no url');
    return { default: url };
  }
  abort() {}
}
function CustomUploadAdapterPlugin(editor: any) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) =>
    new UploadAdapter(loader);
}

export default function DiaryPage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth0, setViewMonth0] = useState(today.getMonth());
  const [selected, setSelected] = useState(toYMD(today));

  const searchParams = useSearchParams();
  const grpCd = searchParams.get('grpCd');

  // 데이터 훅 (ownerId는 훅 내부에서 기본 1로 처리)
  const q = useDiaryByDate({ diaryDt: selected, grpCd });
  const upsert = useUpsertDiary({ grpCd });

  const isBusy = q.isLoading || q.isFetching;

  // CKEditor 동적 로드
  const [CKE, setCKE] = useState<null | { CKEditor: any; ClassicEditor: any }>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { CKEditor } = await import('@ckeditor/ckeditor5-react');
      const ClassicEditor = (await import('@ckeditor/ckeditor5-build-classic')).default;
      if (mounted) setCKE({ CKEditor, ClassicEditor });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 에디터 내용 동기화
  const [content, setContent] = useState('');
  useEffect(() => {
    if (isBusy) return;
    const html = (q.data?.contentHtml ?? q.data?.content ?? '') as string;
    setContent(html || '');
  }, [isBusy, q.data, selected]);

  const onSave = async () => {
    try {
      await upsert.mutateAsync({ diaryDt: selected, content: content || '' });
      alert('저장되었습니다.');
    } catch (e: any) {
      alert(e?.message ?? '저장 실패');
    }
  };

  // 달력
  const matrix = useMemo(() => makeMonthMatrix(viewYear, viewMonth0), [viewYear, viewMonth0]);
  const moveMonth = (d: number) => {
    let m = viewMonth0 + d,
      y = viewYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setViewYear(y);
    setViewMonth0(m);
  };
  const pick = (d: Date) => setSelected(toYMD(d));

  return (
    <div className="diary-root" style={{ maxWidth: PAGE_MAX_WIDTH, margin: '0 auto', padding: 16 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => moveMonth(-1)} aria-label="이전 달">
            {'«'}
          </button>
          <strong style={{ fontSize: 18 }}>
            {viewYear}. {pad(viewMonth0 + 1)}
          </strong>
          <button onClick={() => moveMonth(1)} aria-label="다음 달">
            {'»'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              const t = new Date();
              setViewYear(t.getFullYear());
              setViewMonth0(t.getMonth());
              setSelected(toYMD(t));
            }}
          >
            오늘
          </button>
          <span style={{ border: '1px solid #e5e7eb', borderRadius: 999, padding: '6px 10px' }}>
            선택: <b>{selected}</b>
          </span>
          <button
            onClick={onSave}
            disabled={upsert.isPending}
            style={{ padding: '6px 12px', background: '#111827', color: '#fff', borderRadius: 8 }}
          >
            {upsert.isPending ? '저장중…' : '저장'}
          </button>
        </div>
      </div>

      {/* 달력 */}
      <div className="calendar-wrap" style={{ border: '1px solid #e9edf3', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <table className="diary-calendar">
          <thead>
            <tr>{['일', '월', '화', '수', '목', '금', '토'].map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={ri}>
                {row.map((d, ci) => {
                  const inMonth = d.getMonth() === viewMonth0;
                  const dayStr = toYMD(d);
                  const isSel = dayStr === selected;
                  const isToday = toYMD(d) === toYMD(today);
                  return (
                    <td key={ci} onClick={() => pick(d)} title={dayStr}>
                      <div
                        className="day"
                        style={{
                          background: isSel ? '#111827' : undefined,
                          color: isSel ? '#fff' : isToday ? '#111827' : inMonth ? '#0f172a' : '#9aa4b2',
                          border: !isSel && isToday ? '1px solid #111827' : undefined
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
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            background: '#f8fafc',
            color: '#374151',
            fontSize: 12,
            marginBottom: 8
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#60a5fa', boxShadow: '0 0 0 2px rgba(96,165,250,.25)' }} />
          불러오는 중…
        </div>
      )}

      {/* CKEditor */}
      <div style={{ border: '1px solid #e9edf3', borderRadius: 12, padding: 12, background: '#fff' }}>
        {CKE ? (
          <CKE.CKEditor
            key={`diary-${selected}`}
            editor={CKE.ClassicEditor}
            data={content}
            onChange={(_evt: any, editor: any) => setContent(editor.getData())}
            onReady={(editor: any) => {
              editor.editing.view.change((writer: any) => {
                writer.setStyle('min-height', `${MIN_EDITOR_HEIGHT}px`, editor.editing.view.document.getRoot());
              });
            }}
            config={{ placeholder: '오늘의 일기를 작성하세요…', extraPlugins: [CustomUploadAdapterPlugin] }}
          />
        ) : (
          <div style={{ padding: 12, color: '#6b7280' }}>에디터 로딩 중…</div>
        )}
        <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>이미지는 에디터의 이미지 버튼/붙여넣기로 업로드됩니다.</div>
      </div>

      {/* 스타일: 달력 스코프 고정 */}
      <style jsx>{`
        .diary-calendar {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .diary-calendar thead tr {
          background: #f8fafc;
          color: #0f172a;
        }
        .diary-calendar th {
          padding: 10px 0;
          font-weight: 700;
        }
        .diary-calendar td {
          height: ${CAL_ROW_H}px !important;
          padding: 0;
          text-align: center;
          border-top: 1px solid #f1f3f7;
          vertical-align: middle;
          cursor: pointer;
        }
        .diary-calendar td .day {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: ${DAY_H}px;
          line-height: ${DAY_H}px;
          padding: 0 6px;
          border-radius: 16px;
          user-select: none;
        }
        .calendar-wrap thead {
          background: #f8fafc;
        }
      `}</style>

      {/* CKEditor 전역 높이/여백 */}
      <style jsx global>{`
        .ck-editor {
          width: 100%;
        }
        .ck-editor__editable_inline {
          min-height: ${MIN_EDITOR_HEIGHT}px;
        }
        .ck.ck-editor__main > .ck-editor__editable {
          padding: 16px 18px;
        }
      `}</style>
    </div>
  );
}