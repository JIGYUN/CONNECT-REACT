'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setOwnerId, clearOwnerId, useOwnerIdValue } from '@/shared/core/owner';
import { apiLogout } from '@/shared/core/auth/api';

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ownerId = useOwnerIdValue();

  // ownerId가 있으면 로그인으로 간주
  const loggedIn = ownerId != null;
  const username = loggedIn ? `USER#${ownerId}` : '게스트';

  useEffect(() => {
    // (선택) 다른 페이지에서 ownerId가 생겼다면 반영
    if (loggedIn) setOwnerId(Number(ownerId));
  }, [pathname, loggedIn, ownerId]);

  const logout = async () => {
    try { await apiLogout(); } catch {}
    clearOwnerId();
    setOpen(false);
    window.location.reload();
  };

  return (
    <>
      <button type="button" aria-label="메뉴" onClick={() => setOpen(true)} className={`hamburger ${open ? 'is-open':''}`}>
        <span/><span/><span/>
      </button>

      <div className={`navmenu ${open ? 'navmenu--open' : ''}`}>
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