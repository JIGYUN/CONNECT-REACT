/* filepath: src/app/diary/page.tsx */
'use client';

import dynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

const MobileView = dynamic(() => import('@/views/mobile/diary/page'), { ssr: false, loading: () => <RouteFallback /> });
const WebView    = dynamic(() => import('@/views/web/diary/page'),    { ssr: false, loading: () => <RouteFallback /> });

export default function DiaryPage() {
  const isMobile = useIsMobile();
  const View = isMobile ? MobileView : WebView;
  return <View />;
}