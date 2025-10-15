'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { setOwnerId, clearOwnerId, useOwnerIdValue } from '@/shared/core/owner';
import { apiLogout } from '@/shared/core/auth/api';
import useMounted from './useMounted';

export default function NavMenu() {
  const mounted = useMounted();                  // ★ 마운트 전엔 동일 마크업
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ownerId = useOwnerIdValue();
  const loggedIn = mounted && ownerId != null;   // 마운트 후에만 판단
  const username = loggedIn ? `USER#${ownerId}` : '게스트';

  useEffect(() => { if (loggedIn) setOwnerId(Number(ownerId)); }, [pathname, loggedIn, ownerId]);

  const logout = async () => {
    try { await apiLogout(); } catch {}
    clearOwnerId();
    setOpen(false);
    window.location.reload();
  };

  // 마운트 전에는 빈 컨테이너만 렌더 → 서버/클라이언트 동일
  if (!mounted) return <div data-nav-placeholder="" />;

  return (
    <>
      <button type="button" aria-label="메뉴" onClick={() => setOpen(true)} className={`hamburger ${open ? 'is-open':''}`}>
        <span/><span/><span/>
      </button>

      <div className={`navmenu ${open ? 'navmenu--open' : ''}`} suppressHydrationWarning>
        <div className="navmenu__overlay" onClick={() => setOpen(false)} />
        <aside className="navmenu__sheet" aria-hidden={!open}>
          <div className="navmenu__head">
            <a className="navmenu__brand" href="/">CONNECT</a>
            <button className="navmenu__close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
          </div>

          <div className="navmenu__user">
            <div className="navmenu__avatar">{username.slice(0,1)}</div>
            <div className="navmenu__usertext">
              <div className="navmenu__username">{username}</div>
              <div className="navmenu__sub">{loggedIn ? '로그인됨' : '로그인이 필요합니다'}</div>
            </div>
          </div>

          <hr className="navmenu__divider" />

          <nav className="navmenu__nav" onClick={() => setOpen(false)}>
            <Link href="/boardPost"><span className="mi">•</span> 게시판</Link>
            <Link href="/task"><span className="mi">•</span> 작업</Link>
            <Link href="/diary"><span className="mi">•</span> 다이어리</Link>
            <Link href="/ledger"><span className="mi">•</span> 가계부</Link>
          </nav>

          <div className="navmenu__actions">
            {loggedIn ? (
              <button className="btn btn--outline" onClick={logout}>로그아웃</button>
            ) : (
              <Link className="btn btn--outline" href="/login" onClick={() => setOpen(false)}>로그인</Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}