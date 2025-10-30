'use client';

import Link from 'next/link';
import type { Route } from 'next';
import {
    useEffect,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { usePathname } from 'next/navigation';
import useMounted from './useMounted';

import {
    getClientSession,
    clearClientSession,
} from '@/shared/core/auth/clientSession';
import {
    useOwnerIdValue,
    setOwnerId,
    clearOwnerId,
} from '@/shared/core/owner';
import { apiServerLogout } from '@/shared/core/auth/api';

const routes = {
    home: '/' as Route,
    boardPost: '/boardPost' as Route,
    task: '/task' as Route,
    diary: '/diary' as Route,
    ledger: '/ledger' as Route,
};

type SafeMe = {
    userId: number;
    email: string;
    name: string | null;
};

function usernameFrom(me: SafeMe | null): string {
    if (me?.name && me.name.trim()) return me.name;
    if (me?.email && me.email.includes('@')) {
        return me.email.split('@')[0]!;
    }
    if (me?.userId) return `USER#${me.userId}`;
    return '게스트';
}

export default function NavMenu() {
    const mounted = useMounted();
    const pathname = usePathname();

    const [open, setOpen]: [boolean, Dispatch<SetStateAction<boolean>>] =
        useState<boolean>(false);

    const [me, setMe]: [SafeMe | null, Dispatch<SetStateAction<SafeMe | null>>] =
        useState<SafeMe | null>(null);

    // ownerId는 내부 상태 동기화 용도. 로그인 판정에는 쓰지 않는다.
    const ownerId = (useOwnerIdValue as () => number | null | undefined)();

    // pathname 바뀔 때마다 쿠키 다시 읽어 상태 새로고침
    useEffect(() => {
        const s = getClientSession();
        if (s && typeof s.userId === 'number') {
            setMe({
                userId: s.userId,
                email: s.email,
                name: s.name ?? null,
            });
            // 보조적으로 zustand에도 반영(없다면 세팅)
            if (!ownerId || ownerId !== s.userId) {
                setOwnerId(s.userId);
            }
        } else {
            setMe(null);
        }
    }, [pathname, ownerId]);

    const loggedIn = !!me && me.userId > 0;
    const username = usernameFrom(me);

    const logout = async () => {
        // 백엔드에게도 세션 종료 통보하고 싶으면 호출(없으면 그냥 try/catch로 무시)
        try {
            await apiServerLogout();
        } catch {
            /* ignore */
        }

        // 클라이언트 세션 정리
        clearClientSession();
        clearOwnerId();
        setMe(null);

        setOpen(false);
        window.location.href = '/login';
    };

    if (!mounted) {
        return <div data-nav-placeholder="" />;
    }

    return (
        <>
            {/* 햄버거 버튼 */}
            <button
                type="button"
                aria-label="메뉴"
                onClick={() => setOpen(true)}
                className={`hamburger ${open ? 'is-open' : ''}`}
                style={{
                    position: 'fixed',
                    top: 10,
                    right: 12,
                    zIndex: 60,
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

            <div
                className={`navmenu ${open ? 'navmenu--open' : ''}`}
                suppressHydrationWarning
            >
                <div
                    className="navmenu__overlay"
                    onClick={() => setOpen(false)}
                />
                <aside
                    className="navmenu__sheet"
                    aria-hidden={!open}
                >
                    <div className="navmenu__head">
                        <Link
                            className="navmenu__brand"
                            href={routes.home}
                            onClick={() => setOpen(false)}
                        >
                            CONNECT
                        </Link>
                        <button
                            className="navmenu__close"
                            onClick={() => setOpen(false)}
                            aria-label="닫기"
                        >
                            ×
                        </button>
                    </div>

                    <div className="navmenu__user">
                        <div className="navmenu__avatar">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <div className="navmenu__usertext">
                            <div className="navmenu__username">
                                {username}
                            </div>
                            <div className="navmenu__sub">
                                {loggedIn
                                    ? '로그인됨'
                                    : '로그인이 필요합니다'}
                            </div>
                        </div>
                    </div>

                    <hr className="navmenu__divider" />

                    <nav
                        className="navmenu__nav"
                        onClick={() => setOpen(false)}
                    >
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
                            <button
                                className="btn btn--outline"
                                onClick={logout}
                            >
                                로그아웃
                            </button>
                        ) : (
                            <Link
                                className="btn btn--outline"
                                href={'/login' as Route}
                                onClick={() => setOpen(false)}
                            >
                                로그인
                            </Link>
                        )}
                    </div>
                </aside>
            </div>
        </>
    );
}