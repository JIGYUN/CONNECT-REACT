/* filepath: src/app/boardPost/[postId]/page.tsx */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, Descriptions, Space, Typography, Popconfirm, message } from 'antd';
import { useBoardPostDetail, useDeleteBoardPost } from '@/shared/boardPost/api/queries';
// import DOMPurify from 'dompurify';

const { Title, Text } = Typography;

export default function Page() {
  const params = useParams<{ postId: string }>();
  const postId = Number(Array.isArray(params.postId) ? params.postId[0] : params.postId);
  const { data, isLoading } = useBoardPostDetail(postId);
  const del = useDeleteBoardPost();
  const router = useRouter();

  const onDelete = async () => {
    try {
      await del.mutateAsync(postId);
      message.success('삭제 완료');
      router.push('/boardPost');
    } catch (e: any) {
      message.error(e?.message ?? '삭제 실패');
    }
  };

  if (!Number.isFinite(postId)) return <div className="page">잘못된 경로입니다.</div>;
  if (isLoading) return <div className="page">불러오는 중…</div>;
  if (!data) return <div className="page">게시글을 찾을 수 없습니다.</div>;

  const rawHtml =
    (data as any).contentHtml ??
    (data as any).contentMd ??
    (data as any).content ?? '';
  // const safeHtml = DOMPurify.sanitize(String(rawHtml));
  const safeHtml = String(rawHtml);

  return (
    <div className="page">
      <div className="head">
        <Title level={3} className="hTitle">{data.title ?? '(제목 없음)'}</Title>
        <div className="headAct">
          <Link href={`/boardPost/${postId}/edit`}><Button type="primary">수정</Button></Link>
          <Popconfirm title="삭제하시겠습니까?" onConfirm={onDelete} okButtonProps={{ loading: del.isPending }}>
            <Button danger>삭제</Button>
          </Popconfirm>
          <Link href="/boardPost"><Button>목록</Button></Link>
        </div>
      </div>

      <Text type="secondary" className="sub">
        글번호 {postId}
        {data.writer ? ` · 작성자 ${data.writer}` : ''}
        {data.createdDt ? ` · 작성 ${data.createdDt}` : ''}
        {data.updatedDt ? ` · 수정 ${data.updatedDt}` : ''}
      </Text>

      <div style={{ height: 10 }} />

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="게시판 ID">{data.boardId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="상태">{(data as any).postSttsCd ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="고정일">{(data as any).pinnedDt ?? '-'}</Descriptions.Item>
      </Descriptions>

      <div style={{ height: 12 }} />

      <div className="content" dangerouslySetInnerHTML={{ __html: safeHtml }} />

      <style jsx>{`
        .page { padding: 16px; max-width: 960px; margin: 0 auto; }
        .head {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .hTitle { margin: 0; }
        .headAct { display: grid; grid-auto-flow: column; gap: 8px; justify-content: end; }
        .sub { display: block; }
        .content {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 16px;
          word-break: break-word;
        }
        .content :global(img) { max-width: 100%; height: auto; }
        .content :global(table) { width: 100%; border-collapse: collapse; }
        .content :global(pre) { white-space: pre-wrap; word-break: break-word; }

        @media (max-width: 640px) {
          .page { padding: 12px; }
          .head { grid-template-columns: 1fr; gap: 6px; }
          .headAct { justify-content: start; }
        }
      `}</style>
    </div>
  );
}