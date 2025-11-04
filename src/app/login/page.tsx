// filepath: src/app/login/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setClientSession, getClientSession, type ClientSession } from '@/shared/core/auth/clientSession';
import { apiLogin, type LoginInput } from '@/shared/core/auth/clientSession'; // 같은 파일에서 export하므로 여기서 import

export default function LoginPage() {
  const params = useSearchParams();

  // next 파라미터 안전 디코드(없으면 '/')
  const nextPath = useMemo(() => {
    const raw = params.get('next');
    if (!raw) return '/';
    try {
      const decoded = decodeURIComponent(raw);
      return decoded.startsWith('/') ? decoded : '/';
    } catch {
      return '/';
    }
  }, [params]);

  // 이미 로그인돼 있으면 즉시 이동(Cloudflare에서도 동작)
  useEffect(() => {
    const s = getClientSession();
    if (s) location.replace(nextPath);
  }, [nextPath]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) { setErr('이메일과 비밀번호를 입력하세요.'); return; }

    setSubmitting(true);
    try {
      const res = await apiLogin({ email: e, password: p } as LoginInput);

      const session: ClientSession = {
        userId: res.userId,
        email: res.email,
        name: res.name,
        loggedAt: Date.now(),
      };
      setClientSession(session);

      // 중요: SPA replace 대신 '문서 네비게이션'
      location.replace(nextPath);
    } catch {
      setErr('로그인 실패. 입력을 확인하세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      <div className="card">
        <h2>CONNECT 로그인</h2>
        <label>이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <label>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {err ? <div className="err">{err}</div> : null}
        <button disabled={submitting} onClick={() => void onSubmit()}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </div>

      <style jsx>{`
        .login-root { display:flex; justify-content:center; padding:32px; }
        .card { width:100%; max-width:380px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; }
        h2 { margin:0 0 12px; font-size:20px; font-weight:800; color:#0f172a; }
        label { display:block; margin:10px 0 6px; font-size:12px; color:#6b7280; }
        input { width:100%; height:38px; border:1px solid #e5e7eb; border-radius:8px; padding:0 10px; }
        .err { margin-top:10px; color:#b91c1c; font-size:12px; }
        button { margin-top:14px; width:100%; height:40px; border-radius:10px; border:none; background:#111827; color:#fff; font-weight:700; }
      `}</style>
    </div>
  );
}