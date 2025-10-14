/* filepath: src/app/boardPost/[postId]/page.tsx */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, Descriptions, Space, Typography, Popconfirm, message } from 'antd';
import { useBoardPostDetail, useDeleteBoardPost } from '@/shared/boardPost/api/queries';
// (선택) 보안 sanitize를 원하면 다음 줄을 사용하세요.
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

  if (!Number.isFinite(postId)) return <div style={{ padding: 24 }}>잘못된 경로입니다.</div>;
  if (isLoading) return <div style={{ padding: 24 }}>불러오는 중…</div>;
  if (!data) return <div style={{ padding: 24 }}>게시글을 찾을 수 없습니다.</div>;

  // 서버가 CKEditor HTML을 어디에 저장하든 대응
  const rawHtml =
    (data as any).contentHtml ??
    (data as any).contentMd ??   // 여기에도 HTML이 들어오는 환경이 많음
    (data as any).content ?? '';

  // (선택) XSS가 우려되면 sanitize해서 사용
  // const safeHtml = DOMPurify.sanitize(String(rawHtml));
  const safeHtml = String(rawHtml);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Title level={3} style={{ margin: 0 }}>{data.title ?? '(제목 없음)'}</Title>
        <Space>
          <Link href={`/boardPost/${postId}/edit`}><Button type="primary">수정</Button></Link>
          <Popconfirm title="삭제하시겠습니까?" onConfirm={onDelete} okButtonProps={{ loading: del.isPending }}>
            <Button danger>삭제</Button>
          </Popconfirm>
          <Link href="/boardPost"><Button>목록</Button></Link>
        </Space>
      </Space>

      <Text type="secondary">
        글번호 {postId}
        {data.writer ? ` · 작성자 ${data.writer}` : ''}
        {data.createdDt ? ` · 작성 ${data.createdDt}` : ''}
        {data.updatedDt ? ` · 수정 ${data.updatedDt}` : ''}
      </Text>

      <div style={{ height: 12 }} />

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="게시판 ID">{data.boardId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="상태">{(data as any).postSttsCd ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="고정일">{(data as any).pinnedDt ?? '-'}</Descriptions.Item>
      </Descriptions>

      <div style={{ height: 16 }} />

      {/* 🔽 HTML 렌더링 영역 */}
      <div
        style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16 }}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}