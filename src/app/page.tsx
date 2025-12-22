// src/app/page.tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';

type Quick = { href: Route; title: string; desc: string; icon: string };

const quickActions: readonly Quick[] = [
    { href: '/task' as Route, title: '작업', desc: '할 일/진행 관리', icon: '✅' },
    { href: '/diary' as Route, title: '다이어리', desc: '기록/정리', icon: '📝' },
    { href: '/ledger' as Route, title: '가계부', desc: '지출/수입', icon: '💳' },
    { href: '/reservation' as Route, title: '예약', desc: '일정/리소스', icon: '📅' },
    { href: '/chatRoom' as Route, title: '채팅방', desc: '대화/협업', icon: '💬' },
    { href: '/chatBotRoom' as Route, title: 'AI', desc: 'RAG 기반 질의', icon: '🤖' },
] as const;

function Card({
    title,
    value,
    sub,
}: {
    title: string;
    value: string;
    sub: string;
}) {
    return (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{title}</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
    );
}

type SiteCd = 'REACT_MAIN';

function MainVisitPixel({ siteCd, apiBase }: { siteCd: SiteCd; apiBase: string }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!apiBase) {
            // NEXT_PUBLIC_API_BASE가 비어있으면 자바 서버로 요청이 안 나감
            return;
        }

        // 페이지 진입마다 캐시 회피용 파라미터
        const url = `${apiBase}/px/main.gif?site=${encodeURIComponent(siteCd)}&t=${Date.now()}`;
        setSrc(url);

        // 렌더링과 별개로 즉시 한 번 더 강제 요청(브라우저 캐시/프리로드 이슈 방지)
        const img = new Image();
        img.src = url;
    }, [apiBase, siteCd]);

    if (!src) return null;

    return (
        <img
            src={src}
            width={1}
            height={1}
            style={{ display: 'none' }}
            alt=""
        />
    );
}

export default function HomePage() {
    const apiBase = useMemo(() => {
        const raw = process.env.NEXT_PUBLIC_API_BASE ?? '';
        return raw.replace(/\/+$/, '');
    }, []);

    return (
        <div className="space-y-6">
            {/* 메인 접속 픽셀 */}
            <MainVisitPixel siteCd="REACT_MAIN" apiBase={apiBase} />

            {/* Hero */}
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                            CONNECT
                            <span className="ml-2 text-base font-semibold text-slate-500">
                                업무 · 기록 · 대화 · AI
                            </span>
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            자주 쓰는 기능으로 바로 진입하고, 최근 활동을 한 화면에서 확인합니다.
                        </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        Mobile-first
                    </div>
                </div>

                {/* Quick actions (chips) */}
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {quickActions.slice(0, 5).map((q) => (
                        <Link
                            key={q.href}
                            href={q.href}
                            className="
                                whitespace-nowrap rounded-full border border-[var(--line)] bg-white
                                px-3 py-2 text-sm font-semibold text-slate-700
                                hover:bg-slate-50
                            "
                        >
                            <span className="mr-2" aria-hidden="true">{q.icon}</span>
                            {q.title}
                        </Link>
                    ))}
                </div>
            </section>

            {/* Quick entry grid */}
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slate-900">빠른 진입</h2>
                    <span className="text-xs font-semibold text-slate-500">탭 1번으로 이동</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {quickActions.map((q) => (
                        <Link
                            key={q.href}
                            href={q.href}
                            className="
                                rounded-2xl border border-[var(--line)] bg-white p-4
                                hover:bg-slate-50
                            "
                        >
                            <div className="text-lg" aria-hidden="true">{q.icon}</div>
                            <div className="mt-2 font-extrabold text-slate-900">{q.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{q.desc}</div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Recent activity (empty state) */}
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900">최근 활동</h2>
                <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-slate-50 p-5">
                    <div className="text-sm font-semibold text-slate-700">아직 활동이 없습니다.</div>
                    <div className="mt-1 text-xs text-slate-500">
                        작업/기록/채팅을 시작하면 여기에 최근 항목이 쌓입니다.
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Link
                            href={'/task' as Route}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                        >
                            작업 시작
                        </Link>
                        <Link
                            href={'/chatBotRoom' as Route}
                            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-slate-800"
                        >
                            AI 질문
                        </Link>
                    </div>
                </div>
            </section>

            {/* Tech spotlight */}
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slate-900">품질/성능 설계</h2>
                    <span className="text-xs font-semibold text-slate-500">기술을 가치로 번역</span>
                </div>

                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    <li>• 스트리밍 응답: 체감 속도 개선</li>
                    <li>• RAG 검색: 관련 근거 기반 답변</li>
                    <li>• CI/CD 자동 배포: 운영 안정성</li>
                    <li>• 모듈형 구조: 기능 확장 용이</li>
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                    {['Next.js', 'React Query', 'Zustand', 'FastAPI', 'Qdrant', 'CI/CD'].map((b) => (
                        <span
                            key={b}
                            className="rounded-full border border-[var(--line)] bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700"
                        >
                            {b}
                        </span>
                    ))}
                </div>
            </section>

            <div className="h-2" />
        </div>
    );
}
