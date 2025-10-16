// filepath: src/middleware.ts
import { NextResponse, NextRequest } from 'next/server';

export const config = {
    // /login, /api, 정적 에셋 등은 제외하고 보호
    matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml|login|api).*)'],
};

export function middleware(req: NextRequest) {
    // ✅ 세션 쿠키 존재만 확인
    const hasSession = !!req.cookies.get('connect_session')?.value;

    if (!hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        // 원래 목적지(쿼리 포함)로 되돌아갈 수 있도록 next 유지
        url.searchParams.set('next', req.nextUrl.pathname + (req.nextUrl.search || ''));
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}
