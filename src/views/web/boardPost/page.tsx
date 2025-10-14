/* filepath: src/app/boardPost/page.tsx */
'use client';

import Link from 'next/link';
import { Table, Button, Popconfirm, message } from 'antd';
import { useBoardList, useDeleteBoard } from '@/shared/boardPost';
 
export default function BoardListPage() {
  const { data = [], isLoading } = useBoardList({ boardId: 1 });
  const del = useDeleteBoard();
  const getId = (r: any) => r?.id ?? r?.postId ?? r?.boardIdx;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontWeight: 600, fontSize: 18 }}>게시판</h1>
        <Link href="/boardPost/new"><Button type="primary">새 글</Button></Link>
      </div>

      <Table
        size="middle"
        loading={isLoading}
        rowKey={(r) => String(getId(r))}
        dataSource={data}
        scroll={{ x: 640 }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80, render: (_: any, r: any) => getId(r), responsive: ['sm','md','lg','xl','xxl'] },
          {
            title: '제목',
            dataIndex: 'title',
            ellipsis: true,
            render: (_t: any, r: any) => <Link href={`/boardPost/${getId(r)}`}>{r.title ?? '(제목 없음)'}</Link>,
            responsive: ['xs','sm','md','lg','xl','xxl'],
          },
          { title: '작성자', dataIndex: 'writer', width: 140, responsive: ['sm','md','lg','xl','xxl'] },
          {
            title: '액션',
            width: 200,
            render: (_t: any, r: any) => (
              <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
                <Link href={`/boardPost/${getId(r)}`}><Button size="small">상세</Button></Link>
                <Popconfirm
                  title="삭제하시겠습니까?"
                  onConfirm={async () => {
                    try { await del.mutateAsync(getId(r)); message.success('삭제 완료'); }
                    catch (e: any) { message.error(e?.message ?? '삭제 실패'); }
                  }}
                  okButtonProps={{ loading: del.isPending }}
                >
                  <Button size="small" danger>삭제</Button>
                </Popconfirm>
              </div>
            ),
            responsive: ['xs','sm','md','lg','xl','xxl'],
          },
        ]}
        pagination={{ position: ['bottomCenter'] }}
      />
    </div>
  );
}