// filepath: src/shared/ui/AuthGuard.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useOwnerIdValue } from '@/shared/core/owner';

/** 로그인 없이 접근 불가한 경로 */
const PROTECTED = ['/boardPost', '/task', '/ledger', '/diary'];

/** 정적/이미지/로그인 페이지 등은 항상 통과 */
const PUBLIC_EXACT = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/assets', '/public', '/images', '/fonts'];

function isProtected(pathname: string) {
  if (PUBLIC_EXACT.includes(pathname)) return false;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return false;
  return PROTECTED.some(b => pathname === b || pathname.startsWith(b + '/'));
}

export default function AuthGuard() {
  const ownerId = useOwnerIdValue();           // 로그인 시 setOwnerId로 저장됨(LS/스토어)
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (!isProtected(pathname)) return;

    if (ownerId == null) {
      const next = pathname + (sp?.toString() ? `?${sp}` : '');
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ownerId, pathname, sp]);

  return null; // 가드는 존재만으로 충분
}