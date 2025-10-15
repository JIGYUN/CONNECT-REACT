/* filepath: src/app/boardPost/page.tsx */
'use client';

import { Suspense } from 'react';
import RouteFallback from '@/shared/ui/RouteFallback';
import { useIsMobile } from '@/shared/responsive';

// ✅ 정적 import 권장 (충돌 없음)
import MobileList from '@/views/mobile/boardPost/page';
import WebList from '@/views/web/boardPost/page';

export const dynamic = 'force-dynamic'; // SSG 방지 (원치 않으면 제거 가능)

export default function BoardPostListPage() {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileList : WebList;

  return (
    <Suspense fallback={<RouteFallback />}>
      <View />
    </Suspense>
  );
}