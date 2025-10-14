/* filepath: src/app/boardPost/[postId]/page.tsx */
'use client';

import dynamic from 'next/dynamic';
import { useIsMobile } from '@/shared/responsive';
import RouteFallback from '@/shared/ui/RouteFallback';

const MobileView = dynamic(() => import('@/views/mobile/boardPost/[postId]/edit/page'), { ssr: false, loading: () => <RouteFallback /> });
const WebView    = dynamic(() => import('@/views/web/boardPost/[postId]/edit/page'),    { ssr: false, loading: () => <RouteFallback /> });

export default function BoardPostDetailPage({ params }: { params: { postId: string } }) {
  const isMobile = useIsMobile();
  const View: any = isMobile ? MobileView : WebView;
  return <View params={params} />;
}