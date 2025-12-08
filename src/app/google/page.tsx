'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useEffect } from 'react';
import {
    setClientSession,
    type ClientSession,
} from '@/shared/core/auth/clientSession';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

type MeResult = {
    userId: number | string;
    email: string;
    userNm: string;
};

type MeResponse = {
    ok: boolean;
    result?: MeResult;
};

export default function GoogleLoginBridgePage() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/me`, {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!res.ok) {
                    router.replace('/login' as Route);
                    return;
                }

                const data = (await res.json()) as MeResponse;
                const u = data.result;
                if (!data.ok || !u) {
                    router.replace('/login' as Route);
                    return;
                }

                const userIdNum =
                    typeof u.userId === 'number'
                        ? u.userId
                        : Number(u.userId);

                const session: ClientSession = {
                    userId: userIdNum,
                    email: u.email,
                    name: u.userNm,
                    loggedAt: Date.now(),
                };
                setClientSession(session);

                const rawNext = params.get('next');
                let nextPath: string = '/';
                if (rawNext) {
                    try {
                        const decoded = decodeURIComponent(rawNext);
                        if (decoded.startsWith('/')) {
                            nextPath = decoded;
                        }
                    } catch {
                        /* ignore */
                    }
                }
                if (
                    nextPath.startsWith('/login') ||
                    nextPath.startsWith('/signup')
                ) {
                    nextPath = '/';
                }

                router.replace(nextPath as Route);
            } catch {
                router.replace('/login' as Route);
            }
        };

        void run();
    }, [params, router]);

    return <div>Google 로그인 처리 중…</div>;
}
