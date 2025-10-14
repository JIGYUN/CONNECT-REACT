/* filepath: src/app/boardPost/page.tsx */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Table, Button, Popconfirm, message, Tag } from 'antd';
import { useBoardList, useDeleteBoard } from '@/shared/boardPost';

function useIsMobile(bp = 640) {
  const [isMobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [bp]);
  return isMobile;
}

export default function BoardListPage() {
  const { data = [], isLoading } = useBoardList({ boardId: 1 });
  const del = useDeleteBoard();
  const isMobile = useIsMobile(640);

  const getId = (r: any) => r?.id ?? r?.postId ?? r?.boardIdx;
  const rows = useMemo(() => data ?? [], [data]);

  const onDelete = async (id: number) => {
    try { await del.mutateAsync(id); message.success('삭제 완료'); }
    catch (e: any) { message.error(e?.message ?? '삭제 실패'); }
  };

  return (
    <div className="page">
      <div className="header">
        <h1>게시판</h1>
        <Link href="/boardPost/new">
          <Button type="primary" className="newBtn">새 글</Button>
        </Link>
      </div>

      {isMobile ? (
        <div className="cards">
          {isLoading && <div className="loading">불러오는 중…</div>}
          {!isLoading && rows.length === 0 && <div className="empty">등록된 글이 없습니다.</div>}
          {rows.map((r: any) => {
            const id = getId(r);
            return (
              <article key={id} className="card">
                <div className="top">
                  {/* 🔧 inline style 로도 한 번 더 강제 */}
                  <Link
                    href={`/boardPost/${id}`}
                    className="titleLink"
                    style={{ textDecoration: 'none', color: '#0f172a' }}
                  >
                    {r.title ?? '(제목 없음)'}
                  </Link>
                </div>
                <div className="meta">
                  <span className="id">#{id}</span>
                  {r.writer && <span className="sep">·</span>}
                  {r.writer && <span className="writer">{r.writer}</span>}
                  {r.createdDt && <span className="sep">·</span>}
                  {r.createdDt && <span className="dt">{r.createdDt}</span>}
                  {(r as any).postSttsCd && (<><span className="sep">·</span><Tag>{(r as any).postSttsCd}</Tag></>)}
                </div>
                <div className="actions">
                  <Link href={`/boardPost/${id}`} style={{ textDecoration: 'none' }}>
                    <Button size="small">상세</Button>
                  </Link>
                  <Popconfirm title="삭제하시겠습니까?" onConfirm={() => onDelete(id)} okButtonProps={{ loading: del.isPending }}>
                    <Button size="small" danger>삭제</Button>
                  </Popconfirm>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Table
          size="middle"
          loading={isLoading}
          rowKey={(r) => String(getId(r))}
          dataSource={rows}
          scroll={{ x: 640 }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80, render: (_: any, r: any) => getId(r) },
            {
              title: '제목',
              dataIndex: 'title',
              ellipsis: true,
              render: (_: any, r: any) => (
                <Link
                  href={`/boardPost/${getId(r)}`}
                  className="cellLink"
                  style={{ textDecoration: 'none', color: '#0f172a' }}
                >
                  {r.title ?? '(제목 없음)'}
                </Link>
              ),
            },
            { title: '작성자', dataIndex: 'writer', width: 140 },
            {
              title: '액션',
              width: 200,
              render: (_t: any, r: any) => {
                const id = getId(r);
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/boardPost/${id}`} style={{ textDecoration: 'none' }}>
                      <Button size="small">상세</Button>
                    </Link>
                    <Popconfirm title="삭제하시겠습니까?" onConfirm={() => onDelete(id)} okButtonProps={{ loading: del.isPending }}>
                      <Button size="small" danger>삭제</Button>
                    </Popconfirm>
                  </div>
                );
              },
            },
          ]}
          pagination={{ position: ['bottomCenter'] }}
        />
      )}

      {/* ---- 스타일 ---- */}
      <style jsx>{`
        .page { padding: 16px; max-width: 960px; margin: 0 auto; }
        .header { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; margin-bottom: 12px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }

        .cards { display: grid; gap: 10px; }
        .card { background: #fff; border: 1px solid #e9edf3; border-radius: 12px; padding: 12px; box-shadow: 0 6px 16px rgba(15,23,42,.05); }
        .top { margin-bottom: 6px; }

        /* 제목: 2줄 말줄임 */
        .titleLink {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
          font-size: 16px;
          font-weight: 700;
        }

        .meta { color: #6b7280; font-size: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
        .meta .sep { opacity: .6; }
        .actions { margin-top: 10px; display: flex; gap: 8px; }
        .loading, .empty { padding: 16px; color: #6b7280; text-align: center; }

        @media (max-width: 640px) { .newBtn { height: 34px; padding: 0 12px; } }
      `}</style>

      {/* 전역 오버라이드: 링크 밑줄/색(visited 포함) 완전 차단 */}
      <style jsx global>{`
        /* 카드 내 모든 a, 그리고 테이블 셀 링크 */
        .cards a,
        a.titleLink,
        a.cellLink {
          text-decoration: none !important;
          color: #0f172a !important;
        }
        .cards a:visited,
        a.titleLink:visited,
        a.cellLink:visited {
          color: #0f172a !important;
          text-decoration: none !important;
        }
        .cards a:hover,
        a.titleLink:hover,
        a.cellLink:hover {
          text-decoration: none !important;
          color: #1d4ed8 !important;
        }
        .cards a:focus-visible,
        a.titleLink:focus-visible,
        a.cellLink:focus-visible {
          outline: 2px solid #93c5fd;
          outline-offset: 2px;
          border-radius: 4px;
          text-decoration: none !important;
        }
      `}</style>
    </div>
  );
}