/* filepath: src/app/login/page.tsx */
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Envelope<T = any> = { ok?: boolean; msg?: string; user?: T; result?: any; data?: any };

export default function LoginPage() {
  const sp = useSearchParams();
  const next = sp.get('next') || '/boardPost';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/login/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 🔸 백엔드가 해시하므로 평문을 passwordHash 키로 보냅니다.
        body: JSON.stringify({ email, passwordHash: password }),
      });

      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      const payload: Envelope =
        ct.includes('application/json') ? await res.json() : { ok: res.ok, msg: await res.text() };

      if (!res.ok || payload?.ok === false) {
        setError(payload?.msg || 'invalid credentials');
        return;
      }

      // ✅ 성공 시에만 하드 리다이렉트(쿠키 갱신 확정 후 이동, 루프 차단)
      window.location.replace(next);
    } catch (err: any) {
      setError(err?.message ?? '로그인 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>로그인</h2>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>이메일</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={{ width: '100%', height: 40, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px' }}
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
              style={{ width: '100%', height: 40, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px' }}
            />
          </label>

          {error && (
            <div style={{ color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: 8 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              height: 42,
              borderRadius: 10,
              background: '#111827',
              color: '#fff',
              border: 'none',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          로그인 후 이동: <code>{next}</code>
        </div>
      </div>
    </div>
  );
}