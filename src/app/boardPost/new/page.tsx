/* filepath: src/app/boardPost/new/page.tsx */
'use client';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

export const dynamic = 'force-dynamic'; // SSG 방지 (선택이지만 권장)

const MobileView = nextDynamic(() => import('@/views/mobile/boardPost/new/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});
const WebView = nextDynamic(() => import('@/views/web/boardPost/new/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});

export default function BoardPostNewPage() {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileView : WebView;

  return (
    <Suspense fallback={<RouteFallback />}>
      <View />
    </Suspense>
  );
}