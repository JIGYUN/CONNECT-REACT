// src/app/login/google/success/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

type MeResponse = {
    ok: boolean;
    result?: {
        userId: string;
        email: string;
        userNm: string;
    };
};

export default function GoogleLoginSuccessPage() {
    const router = useRouter();

    useEffect(() => {
        const run = async () => {
            const res = await fetch(`${API_BASE}/api/me`, {
                method: 'GET',
                credentials: 'include', // 세션 쿠키 같이
            });

            if (!res.ok) {
                router.replace('/login');
                return;
            }

            const data = (await res.json()) as MeResponse;
            if (!data.ok || !data.result) {
                router.replace('/login');
                return;
            }

            // TODO: 전역 상태 저장 (Zustand/Context 등)
            // setUser(data.result);

            router.replace('/'); // 메인 이동
        };

        void run();
    }, [router]);

    return <div>Signing you in with Google...</div>;
}
