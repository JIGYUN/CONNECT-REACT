'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';            // ✅ 추가
import { setOwnerId, clearOwnerId } from '@/shared/core/owner';

type ApiRes<T = any> = { ok: boolean; user?: any; msg?: string } & T;

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{ ok: boolean; user?: any }>({ ok: false });
  const pathname = usePathname();                          // ✅ 현재 경로

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/login/api/me', { cache: 'no-store' });
        const j: ApiRes = await r.json();
        if (!alive) return;

        const ok = r.ok && !!j?.ok;
        const user = j?.user;
        setMe({ ok, user });

        // ✅ 재로그인/계정 전환 시마다 ownerId를 최신으로 갱신
        if (ok && user?.userId != null) setOwnerId(user.userId);
      } catch {
        if (!alive) return;
        setMe({ ok: false });
      }
    })();
    return () => { alive = false; };
    // ✅ 경로가 바뀔 때마다 재조회 (로그인 → /ledger 이동 시 반영)
  }, [pathname]);                                          // ✅ 변경

  const username =
    (me.user?.name ?? me.user?.email ?? '').toString().trim() || '사용자';

  const logout = async () => {
    try { await fetch('/login/api/logout', { method: 'POST' }); } catch {}
    clearOwnerId();                                       // ✅ 쿠키/LS 싹 제거
    setOpen(false);
    window.location.reload();
  };

  const close = () => setOpen(false);
  const openMenu = () => setOpen(true);

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        className={`hamburger ${open ? 'is-open' : ''}`}
        onClick={openMenu}
      >
        <span/><span/><span/>
      </button>

      <div className={`navmenu ${open ? 'navmenu--open' : ''}`}>
        <div className="navmenu__overlay" onClick={close} />
        <aside className="navmenu__sheet" aria-hidden={!open}>
          <div className="navmenu__head">
            <a className="navmenu__brand" href="/">CONNECT</a>
            <button className="navmenu__close" onClick={close} aria-label="닫기">×</button>
          </div>

          <div className="navmenu__user">
            <div className="navmenu__avatar">{username.slice(0, 1).toUpperCase()}</div>
            <div className="navmenu__usertext">
              <div className="navmenu__username">{username}</div>
              <div className="navmenu__sub">{me.ok ? '로그인됨' : '로그인이 필요합니다'}</div>
            </div>
          </div>

          <hr className="navmenu__divider" />

          <nav className="navmenu__nav" onClick={close}>
            <Link href="/boardPost"><span className="mi">•</span> 게시판</Link>
            <Link href="/task"><span className="mi">•</span> 플래너</Link>
            <Link href="/diary"><span className="mi">•</span> 다이어리</Link>
            <Link href="/ledger"><span className="mi">•</span> 가계부</Link>
          </nav>

          <div className="navmenu__actions">
            {me.ok ? (
              <button className="btn btn--outline" onClick={logout}>로그아웃</button>
            ) : (
              <Link className="btn btn--outline" href="/login" onClick={close}>로그인</Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}