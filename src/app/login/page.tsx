// filepath: src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiLogin } from '@/shared/core/auth/api';

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
      const r = await apiLogin(email, password);
      if (!r?.ok) throw new Error(r?.msg || '로그인 실패');
      window.location.replace(next);      // 쿠키/상태 정착 후 이동
    } catch (err: any) {
      setError(err?.message ?? '로그인 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100dvh', background:'#f6f8fb' }}>
      <div style={{ width:340, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, boxShadow:'0 6px 24px rgba(0,0,0,.06)' }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:'6px 4px 14px'}}>CONNECT 로그인</h1>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>이메일</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                   autoComplete="username" required
                   style={{ width:'100%', height:40, border:'1px solid #e5e7eb', borderRadius:8, padding:'0 10px' }}/>
          </label>

          <label>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>비밀번호</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                   autoComplete="current-password" required
                   style={{ width:'100%', height:40, border:'1px solid #e5e7eb', borderRadius:8, padding:'0 10px' }}/>
          </label>

          {error && (
            <div style={{ color:'#b91c1c', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:8 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
                  style={{ height:42, borderRadius:8, background:'#111827', color:'#fff', fontWeight:700,
                           border:'none', opacity: submitting ? .7 : 1 }}>
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}