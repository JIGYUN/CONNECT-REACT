// filepath: src/app/layout.tsx
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';

import Providers from './providers';
import '@/styles/globals.css';

import NavMenu from '@/shared/ui/NavMenu';
import BottomTabs from '@/shared/ui/BottomTabs';
import SuspenseFallback from '@/shared/ui/SuspenseFallback';

export const metadata: Metadata = {
    title: 'CONNECT',
    description: 'CONNECT App',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>
                <Providers>
                    {/* ✅ Fixed Header */}
                    <header className="app-header">
                        <div className="app-header__inner">
                            {/* 좌: 햄버거 */}
                            <Suspense fallback={<div className="w-10 h-10" />}>
                                <NavMenu />
                            </Suspense>

                            {/* 중앙: 로고 */}
                            <Link href="/" className="app-logo">
                                CONNECT
                            </Link>

                            {/* 우: 대칭용 스페이서 */}
                            <div className="app-header__spacer" />
                        </div>
                    </header>

                    {/* ✅ Global Suspense + 전역 app-main 패딩으로 “잘림” 해결 */}
                    <Suspense fallback={<SuspenseFallback label="로딩 중..." />}>
                        <main className="app-main">
                            {children}
                        </main>
                    </Suspense>

                    {/* ✅ Bottom Tabs (모바일 메인 네비) */}
                    <BottomTabs />
                </Providers>
            </body>
        </html>
    );
}
