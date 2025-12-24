// filepath: src/shared/ui/BottomTabs.tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

const tabs = [
    { href: '/' as Route, label: '홈', icon: '🏠' },
    { href: '/task' as Route, label: '작업', icon: '✅' },
    { href: '/shop/products' as Route, label: '쇼핑몰', icon: '🛒' }, // ✅ 기록 → 쇼핑몰
    { href: '/chatRoom' as Route, label: '채팅', icon: '💬' },
    { href: '/chatBotRoom' as Route, label: 'AI', icon: '🤖' },
] as const;

function isActive(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomTabs() {
    const pathname = usePathname();

    return (
        <nav className="bottom-tabs md:hidden" aria-label="하단 탭">
            <div className="bottom-tabs__inner">
                {tabs.map((t) => {
                    const active = isActive(pathname, t.href);
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={`bottom-tab ${active ? 'bottom-tab--active' : ''}`}
                        >
                            <span className="bottom-tab__icon" aria-hidden="true">
                                {t.icon}
                            </span>
                            <span className="bottom-tab__label">{t.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
