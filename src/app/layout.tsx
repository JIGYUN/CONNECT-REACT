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

          {/* ✅ 전역 Suspense: 라우트 스트리밍 안전장치 */}
          <Suspense fallback={<SuspenseFallback label="로딩 중..." />}>
            <main className="min-h-[calc(100vh-56px)]">{children}</main>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}