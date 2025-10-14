/* filepath: src/shared/ui/NavMenu.tsx */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ApiRes<T = any> = { ok: boolean; user?: any; msg?: string } & T;

export default function NavMenu({
  placement = 'header', // 'header' | 'fixed'
}: {
  placement?: 'header' | 'fixed';
}) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{ ok: boolean; user?: any }>({ ok: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/login/api/me', { cache: 'no-store' });
        const j: ApiRes = await r.json();
        if (!alive) return;
        setMe({ ok: r.ok && !!j?.ok, user: j?.user });
      } catch {
        if (!alive) return;
        setMe({ ok: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  const username =
    (me.user?.name ?? me.user?.email ?? '').toString().trim() || '사용자';

  const logout = async () => {
    try {
      await fetch('/login/api/logout', { method: 'POST' });
    } catch {}
    setOpen(false);
    window.location.reload();
  };

  const btnClass =
    placement === 'fixed' ? 'hamburger hamburger--fixed' : 'hamburger';

  return (
    <>
      {/* 버튼 위치: 헤더 안(or 고정) */}
      <button
        type="button"
        aria-label="메뉴 열기"
        className={btnClass}
        onClick={() => setOpen(true)}
      >
        <span /><span /><span />
      </button>

      {/* 드로어/오버레이 */}
      <div className={`navmenu ${open ? 'navmenu--open' : ''}`}>
        <div className="navmenu__overlay" onClick={() => setOpen(false)} />

        <aside className="navmenu__sheet" aria-hidden={!open}>
          <div className="navmenu__head">
            <a className="navmenu__brand" href="/">CONNECT</a>
            <button className="navmenu__close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
          </div>

          <div className="navmenu__user">
            <div className="navmenu__avatar">{username.slice(0, 1).toUpperCase()}</div>
            <div className="navmenu__usertext">
              <div className="navmenu__username">{username}</div>
              <div className="navmenu__sub">{me.ok ? '로그인됨' : '로그인이 필요합니다'}</div>
            </div>
          </div>

          <hr className="navmenu__divider" />

          <nav className="navmenu__nav" onClick={() => setOpen(false)}>
            <Link href="/boardPost"><span className="mi">•</span> 게시판</Link>
            <Link href="/task"><span className="mi">•</span> 플래너</Link>
            <Link href="/diary"><span className="mi">•</span> 다이어리</Link>
            <Link href="/ledger"><span className="mi">•</span> 가계부</Link>
          </nav>

          <div className="navmenu__actions">
            {me.ok ? (
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