/* filepath: src/middleware.ts */
import { NextRequest, NextResponse } from 'next/server';

/** 로그인 없이 들어가면 안 되는 경로들(정규 경로 기준) */
const PROTECTED = ['/boardPost', '/task', '/ledger', '/diary'];

/** 항상 통과시킬 경로들(정적, 로그인, 내부 API 등) */
const PUBLIC_PREFIXES = [
  '/_next',           // Next 정적
  '/favicon.ico',
  '/login/api',       // 로그인 API
  '/api/',            // (있다면) 외부 공개 API
  '/assets',
  '/public',
  '/images',
  '/fonts',
];

const PUBLIC_EXACT = ['/login']; // 로그인 화면 자체

function isProtectedPath(pathname: string) {
  // 로그인/정적 등은 무조건 통과
  if (PUBLIC_EXACT.includes(pathname)) return false;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return false;

  // 보호 경로에 해당되면 true
  return PROTECTED.some(base => pathname === base || pathname.startsWith(base + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 보호 경로가 아니면 패스
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // 세션 쿠키가 있으면 통과
  const hasSession = !!req.cookies.get('connect_session')?.value;
  if (hasSession) return NextResponse.next();

  // 없으면 로그인으로
  const url = new URL('/login', req.url);
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // 정적파일 제외하고 전역 적용
  matcher: ['/((?!.*\\.).*)'],
};