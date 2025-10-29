// filepath: src/shared/ui/NavMenu.tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { usePathname } from 'next/navigation';
import { apiLogout, apiMe } from '@/shared/core/auth/api';
import useMounted from './useMounted';
import { useOwnerIdValue } from '@/shared/core/owner';

/** ── Safe types & narrowing ─────────────────────────────────────────── */
type UnknownRec = Record<string, unknown>;
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 외부 타입 의존 제거: 이 파일에서 확정 타입 정의 */
type MeResultSafe = {
  userId: number;
  name: string | null;
  email: string | null;
};

/** apiMe() 응답을 MeResultSafe | null 로 안전 변환 */
function toMeResult(u: unknown): MeResultSafe | null {
  if (!u || typeof u !== 'object') return null;
  const o = u as UnknownRec;
  const idVal = o['userId'];
  if (!(typeof idVal === 'number' && Number.isFinite(idVal))) return null;

  const nameVal = o['name'];
  const emailVal = o['email'];

  return {
    userId: idVal,
    name: typeof nameVal === 'string' ? nameVal : null,
    email: typeof emailVal === 'string' ? emailVal : null,
  };
}

/** 항상 string 반환 */
function selectUsername(me: MeResultSafe | null, ownerId: number | null | undefined): string {
  if (me && isString(me.name) && me.name.trim()) return me.name;
  if (me && isString(me.email) && me.email.includes('@')) return me.email.split('@')[0]!;
  if (typeof ownerId === 'number' && ownerId > 0) return `USER#${ownerId}`;
  return '게스트';
}

const routes = {
  home: '/' as Route,
  boardPost: '/boardPost' as Route,
  task: '/task' as Route,
  diary: '/diary' as Route,
  ledger: '/ledger' as Route,
};

export default function NavMenu() {
  const mounted = useMounted();
  const pathname = usePathname();

  const [open, setOpen]: [boolean, Dispatch<SetStateAction<boolean>>] = useState<boolean>(false);
  const [me, setMe]: [MeResultSafe | null, Dispatch<SetStateAction<MeResultSafe | null>>] =
    useState<MeResultSafe | null>(null);

  const ownerId = (useOwnerIdValue as () => number | null | undefined)();

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const raw = await (apiMe as () => Promise<unknown | null>)();
        if (!abort) setMe(toMeResult(raw));
      } catch {
        if (!abort) setMe(null);
      }
    })();
    return () => {
      abort = true;
    };
  }, [pathname]);

  const loggedIn =
    (me?.userId ?? null) !== null ||
    (me?.email ? me.email.length > 0 : false) ||
    (typeof ownerId === 'number' && ownerId > 0);

  const username: string = selectUsername(me, ownerId);

  const logout = async () => {
    try {
      await (apiLogout as () => Promise<unknown>)();
    } catch {}
    setOpen(false);
    window.location.href = '/login';
  };

  if (!mounted) return <div data-nav-placeholder="" />;

  return (
    <>
      {/* ▶︎ 햄버거 버튼만 오른쪽 상단에 고정 */}
      <button
        type="button"
        aria-label="메뉴"
        onClick={() => setOpen(true)}
        className={`hamburger ${open ? 'is-open' : ''}`}
        style={{
          position: 'fixed',
          top: 10,
          right: 12,
          zIndex: 60,          // 헤더 위, 사이드시트/오버레이 보다는 낮게
          width: 40,
          height: 40,
          borderRadius: 12,
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,.06)',
        }}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`navmenu ${open ? 'navmenu--open' : ''}`} suppressHydrationWarning>
        <div className="navmenu__overlay" onClick={() => setOpen(false)} />
        <aside className="navmenu__sheet" aria-hidden={!open}>
          <div className="navmenu__head">
            <Link className="navmenu__brand" href={routes.home} onClick={() => setOpen(false)}>
              CONNECT
            </Link>
            <button className="navmenu__close" onClick={() => setOpen(false)} aria-label="닫기">
              ×
            </button>
          </div>

          <div className="navmenu__user">
            <div className="navmenu__avatar">{username.charAt(0)}</div>
            <div className="navmenu__usertext">
              <div className="navmenu__username">{username}</div>
              <div className="navmenu__sub">{loggedIn ? '로그인됨' : '로그인이 필요합니다'}</div>
            </div>
          </div>

          <hr className="navmenu__divider" />

          <nav className="navmenu__nav" onClick={() => setOpen(false)}>
            <Link href={routes.task}>
              <span className="mi">•</span> 작업
            </Link>
            <Link href={routes.diary}>
              <span className="mi">•</span> 다이어리
            </Link>
            <Link href={routes.ledger}>
              <span className="mi">•</span> 가계부
            </Link>
          </nav>

          <div className="navmenu__actions">
            {loggedIn ? (
              <button className="btn btn--outline" onClick={logout}>
                로그아웃
              </button>
            ) : (
              <Link className="btn btn--outline" href={'/login' as Route} onClick={() => setOpen(false)}>
                로그인
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
