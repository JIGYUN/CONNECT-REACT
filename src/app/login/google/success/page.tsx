// filepath: src/app/login/google/success/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import {
    setClientSession,
    type ClientSession,
} from '@/shared/core/auth/clientSession';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

type GoogleCompleteResponse = {
    ok: boolean;
    result?: {
        userId: string | number;
        email: string;
        userNm: string;
    };
    error?: string;
};

export default function GoogleLoginSuccessPage() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        const run = async () => {
            const loginToken = params.get('loginToken');
            const nextParam = params.get('next');

            // next 파라미터 정규화 → Route 타입으로 고정
            let nextPath: Route = '/' as Route;
            if (nextParam && nextParam.startsWith('/')) {
                nextPath = nextParam as Route;
            }

            if (!loginToken) {
                console.warn('[GoogleSuccess] loginToken 없음');
                router.replace('/login');
                return;
            }

            try {
                // 1) 임시토큰 소비 + 서버 세션 생성
                const res = await fetch(`${API_BASE}/api/auth/google/complete`, {
                    method: 'POST',
                    credentials: 'include', // JSESSIONID 쿠키 받기
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: loginToken }),
                });

                if (!res.ok) {
                    console.warn('[GoogleSuccess] complete API 실패', res.status);
                    router.replace('/login');
                    return;
                }

                const data = (await res.json()) as GoogleCompleteResponse;
                if (!data.ok || !data.result) {
                    console.warn('[GoogleSuccess] complete 응답 오류', data.error);
                    router.replace('/login');
                    return;
                }

                // 2) 프론트 로컬 세션(connect_session) 세팅
                const user = data.result;

                // userId를 number로 정규화
                const userIdNum =
                    typeof user.userId === 'number'
                        ? user.userId
                        : Number(user.userId);

                const session: ClientSession = {
                    userId: Number.isNaN(userIdNum) ? 0 : userIdNum,
                    email: user.email,
                    name: user.userNm,
                    loggedAt: Date.now(),
                };
                setClientSession(session);

                // 3) 원래 가려던 페이지로 이동
                router.replace(nextPath);
            } catch (e) {
                console.error('[GoogleSuccess] 예외 발생', e);
                router.replace('/login');
            }
        };

        void run();
    }, [router, params]);

    return <div>Signing you in with Google...</div>;
}
