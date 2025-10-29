// filepath: src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /login, /api, 정적 리소스는 보호 제외
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|login|api).*)',
  ],
};

export function middleware(req: NextRequest) {
  // ✅ 값 파싱하지 말고 존재만 판단
  const hasSession = !!req.cookies.get('connect_session')?.value;

  // 개발 중 디버그용(필요 없으면 제거)
  // console.log('[middleware] hasSession=', hasSession);

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname + (req.nextUrl.search || ''));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}