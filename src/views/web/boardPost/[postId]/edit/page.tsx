/* filepath: src/app/boardPost/[postId]/edit/page.tsx */
'use client';

import { message } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import PostForm from '@/shared/boardPost/ui/PostForm';
import { useBoardPostDetail, useUpdateBoardPost } from '@/shared/boardPost';

export default function EditPostPage() {
  const { postId } = useParams() as { postId: string };
  const id = Number(postId);
  const router = useRouter();
  const { data, isLoading } = useBoardPostDetail(id);
  const update = useUpdateBoardPost();

  return ( 
    <div style={{ padding: 20 }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>글 수정</h1>

      {!data && isLoading ? (
        <div>로딩 중…</div>
      ) : (
        <PostForm
          mode="edit"
          initial={data ?? {}}
          submitting={update.isPending}
          onSubmit={async (values) => {
            await update.mutateAsync({ postId: id, ...values });
            message.success('수정 완료');
            router.push(`/boardPost/${id}`);
          }}
          onCancel={() => router.back()}
        />
      )}
    </div>
  );
}