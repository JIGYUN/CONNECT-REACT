/* filepath: src/app/boardPost/new/page.tsx */
'use client';

import { message } from 'antd';
import { useRouter } from 'next/navigation';
import PostForm from '@/shared/boardPost/ui/PostForm';
import { useCreateBoardPost } from '@/shared/boardPost';

export default function NewPostPage() {
  const router = useRouter();  
  const create = useCreateBoardPost();

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>새 글 작성</h1>

      <PostForm
        mode="create"
        submitting={create.isPending}
        onSubmit={async (values) => {
          await create.mutateAsync(values);
          message.success('등록 완료');
          router.push('/boardPost');
        }}
        onCancel={() => router.back()}
      />
    </div>
  );
}