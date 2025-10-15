/* filepath: src/app/boardPost/[postId]/page.tsx */
'use client';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

export const dynamic = 'force-dynamic';

const MobileView = nextDynamic(() => import('@/views/mobile/boardPost/[postId]/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});
const WebView = nextDynamic(() => import('@/views/web/boardPost/[postId]/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});

export default function BoardPostDetailPage({ params }: { params: { postId: string } }) {
  const isMobile = useIsMobile();
  const View: any = isMobile ? MobileView : WebView;
  return (
    <Suspense fallback={<RouteFallback />}>
      <View params={params} />
    </Suspense>
  );
}