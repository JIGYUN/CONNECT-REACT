/* filepath: src/app/ledger/page.tsx */
'use client';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

export const dynamic = 'force-dynamic';

const MobileView = nextDynamic(() => import('@/views/mobile/ledger/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});
const WebView = nextDynamic(() => import('@/views/web/ledger/page'), {
  ssr: false,
  loading: () => <RouteFallback />,
});

export default function LedgerPage() {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileView : WebView;

  return (
    <Suspense fallback={<RouteFallback />}>
      <View />
    </Suspense>
  );
}