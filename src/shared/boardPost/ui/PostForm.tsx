/* filepath: src/app/features/boardPost/ui/PostForm.tsx */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Form, Input, Button } from 'antd';

type Values = {
  title: string;
  writer?: string;
  contentMd?: string;     // 폼 필드명은 contentMd로 통일
  boardId?: number;
};

export default function PostForm({
  mode, initial, submitting, onSubmit, onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<Values & { contentHtml?: string }>;
  submitting?: boolean;
  onSubmit: (values: Values) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [form] = Form.useForm<Values>();

  // CKEditor 동적 로드(SSR 회피)
  const [CKE, setCKE] = useState<null | { CKEditor: any; ClassicEditor: any }>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { CKEditor } = await import('@ckeditor/ckeditor5-react');
      const ClassicEditor = (await import('@ckeditor/ckeditor5-build-classic')).default;
      if (mounted) setCKE({ CKEditor, ClassicEditor });
    })();
    return () => { mounted = false; };
  }, []);

  // 에디터는 로컬 state로 제어 → Form 업데이트 루프 방지
  const [contentMd, setContentMd] = useState(initial?.contentMd ?? '');
  useEffect(() => {
    form.setFieldsValue({
      title: initial?.title ?? '',
      writer: initial?.writer ?? '',
      contentMd: initial?.contentMd ?? '',
    });
    setContentMd(initial?.contentMd ?? '');
  }, [initial, form]);

  const handleFinish = async (v: Values) => {
    await onSubmit({ ...v, contentMd, boardId: v.boardId ?? 1 });
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <Form.Item name="title" label="제목" rules={[{ required: true, message: '제목을 입력하세요' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="writer" label="작성자">
        <Input />
      </Form.Item>

      <Form.Item label="내용 (Markdown/HTML 저장)">
        {CKE ? (
          <CKE.CKEditor
            editor={CKE.ClassicEditor}
            data={contentMd}
            onChange={(_e: any, editor: any) => setContentMd(editor.getData())}
            onReady={(editor: any) => {
              editor.editing.view.change((writer: any) => {
                writer.setStyle('min-height', '360px', editor.editing.view.document.getRoot());
              });
            }}
            config={{
              placeholder: '내용을 입력하세요…',
            }}
          />
        ) : (
          <Input.TextArea rows={10} placeholder="에디터 로딩 중…" />
        )}
      </Form.Item>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button htmlType="submit" type="primary" loading={submitting}>
          {mode === 'create' ? '등록' : '수정'}
        </Button>
        {onCancel && <Button onClick={onCancel}>취소</Button>}
      </div>
    </Form>
  );
}