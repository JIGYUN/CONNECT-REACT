/* filepath: src/app/boardPost/[postId]/edit/page.tsx */
'use client';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

export const dynamic = 'force-dynamic';

const MobileView = nextDynamic(() => import('@/views/mobile/boardPost/[postId]/edit/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});
const WebView = nextDynamic(() => import('@/views/web/boardPost/[postId]/edit/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});

export default function BoardPostEditPage({ params }: { params: { postId: string } }) {
  const isMobile = useIsMobile();
  const View: any = isMobile ? MobileView : WebView;
  return (
    <Suspense fallback={<RouteFallback />}>
      <View params={params} />
    </Suspense>
  );
}