// filepath: src/middleware.ts
import { NextResponse } from 'next/server';

// 정적 export + 크로스도메인 쿠키 구조에서는 미들웨어가 의미 없음 → 전부 통과
export const config = { matcher: [] };
export function middleware() {
  return NextResponse.next();
}