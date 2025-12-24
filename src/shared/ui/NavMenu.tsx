// filepath: src/app/NavMenu.tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { usePathname } from 'next/navigation';
import useMounted from './useMounted';

import { getClientSession, clearClientSession } from '@/shared/core/auth/clientSession';
import { useOwnerIdValue, setOwnerId, clearOwnerId } from '@/shared/core/owner';
import { apiServerLogout, clearUserFcmToken, setUserFcmToken } from '@/shared/core/auth/api';

/* ───────────────────────── 라우트 ───────────────────────── */
const routes = {
    home: '/' as Route,
    task: '/task' as Route,
    diary: '/diary' as Route,
    ledger: '/ledger' as Route,
    reservation: '/reservation' as Route,
    chatRoom: '/chatRoom' as Route,
    chatBotRoom: '/chatBotRoom' as Route,
    products: '/shop/products' as Route,
} as const;

/* ───────────────────────── 유틸 ───────────────────────── */
type SafeMe = { userId: number; email: string; name: string | null };

function usernameFrom(me: SafeMe | null): string {
    if (me?.name && me.name.trim()) return me.name;
    if (me?.email && me.email.includes('@')) return me.email.split('@')[0] ?? '게스트';
    if (me?.userId) return `USER#${me.userId}`;
    return '게스트';
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}
function pickStr(o: Record<string, unknown>, key: string): string | null {
    const v = o[key];
    return typeof v === 'string' ? v : null;
}

/** window.Android?.postMessage 안전 추출(브래킷 접근만 사용) */
function getAndroidPostMessage(): ((payload: string) => void) | null {
    const w: unknown = typeof window !== 'undefined' ? window : null;
    if (!isObject(w)) return null;
    const a = (w as Record<string, unknown>)['Android'];
    if (!isObject(a)) return null;
    const fn = (a as Record<string, unknown>)['postMessage'];
    return typeof fn === 'function' ? (fn as (payload: string) => void) : null;
}

/* ───────────────────────── 컴포넌트 ───────────────────────── */
export default function NavMenu() {
    const mounted = useMounted();
    const pathname = usePathname();

    const [open, setOpen]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false);
    const [me, setMe]: [SafeMe | null, Dispatch<SetStateAction<SafeMe | null>>] = useState<SafeMe | null>(null);

    const ownerId = (useOwnerIdValue as () => number | null | undefined)();
    const lastTokenRef = useRef<string | null>(null);

    const PENDING = 'pending_fcm_token';
    const LAST = 'last_fcm_token';

    useEffect(() => {
        const s = getClientSession();
        if (s && typeof s.userId === 'number') {
            setMe({ userId: s.userId, email: s.email, name: s.name ?? null });
            if (!ownerId || ownerId !== s.userId) setOwnerId(s.userId);
        } else {
            setMe(null);
        }
    }, [pathname]);

    /* ───────── WebView FCM 토큰 수신/요청 ───────── */
    useEffect(() => {
        if (!mounted) return;

        const onNative = (ev: Event) => {
            const dUnknown: unknown = (ev as { detail?: unknown }).detail;
            if (typeof dUnknown !== 'string') return;

            let msg: unknown;
            try { msg = JSON.parse(dUnknown); } catch { return; }
            if (!isObject(msg)) return;

            const type = pickStr(msg, 'type');
            if (type !== 'fcm-token') return;

            const token = pickStr(msg, 'token');
            if (!token) return;

            if (lastTokenRef.current !== token) {
                lastTokenRef.current = token;
                alert(`FCM TOKEN 수신:\n${token}`);
            }

            try {
                window.localStorage.setItem(PENDING, token);
                window.localStorage.setItem(LAST, token);
            } catch { /* ignore */ }
        };

        window.addEventListener('native', onNative as EventListener);

        try {
            const fn = getAndroidPostMessage();
            if (fn) {
                const payload = JSON.stringify({ type: 'getFcmToken', origin: location.host });
                fn(payload);
            }
        } catch { /* ignore */ }

        return () => window.removeEventListener('native', onNative as EventListener);
    }, [mounted]);

    /* ───────── 로그인 이후 백업 업서트 루프 ───────── */
    useEffect(() => {
        if (!mounted) return;
        const s = getClientSession();
        const uid = s && typeof s.userId === 'number' ? s.userId : null;
        if (!uid) return;

        try {
            const pending = localStorage.getItem(PENDING);
            const last = localStorage.getItem(LAST);
            if (pending && pending !== last) {
                lastTokenRef.current = pending;
                localStorage.setItem(LAST, pending);
                localStorage.removeItem(PENDING);
                void setUserFcmToken({
                    userId: uid,
                    fcmToken: pending,
                    platformInfo: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                }).catch(() => {});
            }
        } catch { /* ignore */ }
    }, [mounted, me?.userId, pathname]);

    const loggedIn = !!me && me.userId > 0;
    const username = usernameFrom(me);

    const logout = async () => {
        try { await apiServerLogout(); } catch { /* ignore */ }
        try {
            if (me?.userId) await clearUserFcmToken(me.userId);
        } catch { /* ignore */ }

        clearClientSession();
        clearOwnerId();
        setMe(null);
        setOpen(false);
        window.location.href = '/login';
    };

    if (!mounted) return <div data-nav-placeholder="" />;

    return (
        <>
            {/* ✅ 헤더 안에 들어가는 햄버거 (fixed 제거) */}
            <button
                type="button"
                aria-label="메뉴"
                onClick={() => setOpen(true)}
                className={`hamburger ${open ? 'is-open' : ''}`}
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
                        <button className="navmenu__close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
                    </div>

                    <div className="navmenu__user">
                        <div className="navmenu__avatar">{username.charAt(0).toUpperCase()}</div>
                        <div className="navmenu__usertext">
                            <div className="navmenu__username">{username}</div>
                            <div className="navmenu__sub">{loggedIn ? '로그인됨' : '로그인이 필요합니다'}</div>
                        </div>
                    </div>

                    <hr className="navmenu__divider" />

                    <nav className="navmenu__nav" onClick={() => setOpen(false)}>
                        <Link href={routes.products}><span className="mi">•</span> 쇼핑몰</Link>
                        <Link href={routes.chatBotRoom}><span className="mi">•</span> 챗봇</Link>
                        <Link href={routes.task}><span className="mi">•</span> 작업</Link>
                        <Link href={routes.diary}><span className="mi">•</span> 다이어리</Link>
                        <Link href={routes.ledger}><span className="mi">•</span> 가계부</Link>
                        <Link href={routes.reservation}><span className="mi">•</span> 예약</Link>
                        <Link href={routes.chatRoom}><span className="mi">•</span> 채팅방</Link>
                        
                    </nav>

                    <div className="navmenu__actions">
                        {loggedIn ? (
                            <button
                                className="btn btn--outline"
                                onClick={logout}
                                style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
                            >
                                로그아웃
                            </button>
                        ) : (
                            <Link
                                className="btn btn--outline"
                                href={'/login' as Route}
                                onClick={() => setOpen(false)}
                                style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
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
