// filepath: src/app/login/page.tsx
'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import RouteFallback from '@/shared/ui/RouteFallback';
import { loginAndSetSession } from '@/shared/core/auth/actions';
import { setOwnerId } from '@/shared/core/owner';

export const dynamic = 'force-dynamic';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const dest = sp?.get('next');
  const nextPath: Route = (dest && dest.startsWith('/') ? (dest as Route) : ('/boardPost' as Route));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await loginAndSetSession({ email, password });
      if (!res.ok) {
        setError(res.msg || '로그인 실패');
        return;
      }
      setOwnerId(res.userId);
      document.cookie = 'ownerId=; Path=/; Max-Age=0; SameSite=Lax';
      router.replace(nextPath);
    });
  };

  // 상단 정렬: 헤더 높이를 고려해서 살짝 여백만 주고, 세로 가운데 정렬 제거
  const HEADER_H = 56; // 헤더 높이(필요하면 조절)
  return (
    <div
      style={{
        background: '#f6f8fb',
        minHeight: `calc(100dvh - ${HEADER_H}px)`,
        paddingTop: 150,         // 원하는 만큼 올리고/내리기 → 수치만 조정
        paddingBottom: 24,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start', // ⬅️ 위쪽 정렬
      }}
    >
      <div
        style={{
          width: 340,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 6px 24px rgba(0,0,0,.06)',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '6px 4px 14px' }}>CONNECT 로그인</h1>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>이메일</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: '100%',
                height: 40,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0 10px',
              }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>비밀번호</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: '100%',
                height: 40,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0 10px',
              }}
            />
          </label>

          {error && (
            <div
              style={{
                color: '#b91c1c',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              height: 42,
              borderRadius: 8,
              background: '#111827',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              opacity: pending ? 0.7 : 1,
              // 텍스트 정확히 중앙 정렬
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            {pending ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <LoginInner />
    </Suspense>
  );
}
