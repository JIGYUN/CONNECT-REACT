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
    <div className="page">
      <h1 className="title">새 글 작성</h1>

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

      <style jsx>{`
        .page { padding: 16px; max-width: 960px; margin: 0 auto; }
        .title { font-weight: 700; font-size: 20px; margin: 0 0 12px; }
        @media (max-width: 640px) { .page { padding: 12px; } }
      `}</style>
    </div>
  );
}