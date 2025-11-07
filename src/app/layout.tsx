// filepath: src/app/layout.tsx
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';

import Providers from './providers';
import '@/styles/globals.css';
import NavMenu from '@/shared/ui/NavMenu';
import SuspenseFallback from '@/shared/ui/SuspenseFallback';

export const metadata = {
    title: 'CONNECT',
    description: 'CONNECT App',
};

/** ✅ iOS/안드로이드 safe-area 지원 */
export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>
                <Providers>
                    <header className="h-14 flex items-center justify-between px-4 border-b bg-white">
                        <Link href="/" className="font-semibold tracking-wide">
                            CONNECT
                        </Link>
                        <Suspense fallback={<div className="px-2"><div className="h-6 w-24 animate-pulse bg-gray-200 rounded" /></div>}>
                            <NavMenu />
                        </Suspense>
                    </header>

                    {/* ✅ 전역 Suspense */}
                    <Suspense fallback={<SuspenseFallback label="로딩 중..." />}>
                        {/* 
                           ✅ 모바일 하단 안전 패딩
                           - 56px 헤더를 제외한 영역(min-h) 유지
                           - 모바일에서만 하단 여백을 확보해 버튼이 네비게이션 바에 가리지 않도록 함
                        */}
                        <main
                            className="
                                min-h-[calc(100vh-56px)]
                                md:pb-0
                                pb-[calc(20px+env(safe-area-inset-bottom))]
                                bg-white
                            "
                        >
                            {children}
                        </main>
                    </Suspense>

                    {/* (선택) 전역 푸터 슬롯: 필요 시 여기에 고정 푸터 컴포넌트 추가 가능 */}
                    {/* <GlobalActionFooter /> */}
                </Providers>
            </body>
        </html>
    );
}
