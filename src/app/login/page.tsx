'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    setClientSession,
    getClientSession,
    type ClientSession,
} from '@/shared/core/auth/clientSession';
import { apiLogin, type LoginInput } from '@/shared/core/auth/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export default function LoginPage() {
    const params = useSearchParams();

    const nextPath = useMemo(() => {
        const raw = params.get('next');
        let path = '/';
        if (raw) {
            try {
                const decoded = decodeURIComponent(raw);
                if (decoded.startsWith('/')) path = decoded;
            } catch {
                /* ignore */
            }
        }
        if (path.startsWith('/login') || path.startsWith('/signup')) return '/';
        return path;
    }, [params]);

    useEffect(() => {
        const s = getClientSession();
        if (s) {
            location.replace(nextPath);
        }
    }, [nextPath]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const onSubmit = async () => {
        setErr(null);
        const e = email.trim();
        const p = password.trim();
        if (!e || !p) {
            setErr('이메일과 비밀번호를 입력하세요.');
            return;
        }

        let fcmToken: string | null = null;
        try {
            const t =
                typeof localStorage !== 'undefined'
                    ? localStorage.getItem('pending_fcm_token')
                    : null;
            fcmToken = t && t.trim() ? t : null;
        } catch {
            /* ignore */
        }

        const platformInfo: string | null =
            typeof navigator !== 'undefined' && navigator.userAgent
                ? navigator.userAgent
                : null;

        setSubmitting(true);
        try {
            const payload: LoginInput = {
                email: e,
                password: p,
                ...(fcmToken !== null ? { fcmToken } : {}),
                ...(platformInfo !== null ? { platformInfo } : {}),
            };

            const res = await apiLogin(payload);

            const session: ClientSession = {
                userId: res.userId,
                email: res.email,
                name: res.name,
                loggedAt: Date.now(),
            };
            setClientSession(session);

            try {
                localStorage.removeItem('pending_fcm_token');
            } catch {
                /* ignore */
            }

            location.replace(nextPath);
        } catch {
            setErr('로그인 실패. 입력을 확인하세요.');
        } finally {
            setSubmitting(false);
        }
    };

    const onGoogleLogin = () => {
        if (!API_BASE) {
            alert('API 서버 설정이 필요합니다.');
            return;
        }
        if (typeof window === 'undefined') return;

        const origin = window.location.origin; // http://localhost:3000
        const baseSuccessUrl = `${origin}/login/google/success`;
        const successUrl =
            nextPath === '/'
                ? baseSuccessUrl
                : `${baseSuccessUrl}?next=${encodeURIComponent(nextPath)}`;

        const redirectParam = encodeURIComponent(successUrl);
        const url = `${API_BASE}/auth/google/login?redirect=${redirectParam}`;

        window.location.href = url;
    };

    const signupNext =
        nextPath === '/'
            ? '/signup'
            : `/signup?next=${encodeURIComponent(nextPath)}`;

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

                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                        void onSubmit();
                    }}
                >
                    {submitting ? '로그인 중…' : '로그인'}
                </button>

                <div className="divider">
                    <span className="line" />
                    <span className="divider-text">또는</span>
                    <span className="line" />
                </div>

                <button
                    type="button"
                    className="google-btn"
                    onClick={onGoogleLogin}
                >
                    <span className="google-icon" aria-hidden="true" />
                    <span>Google 계정으로 로그인</span>
                </button>

                <div className="sub">
                    계정이 없으신가요?{' '}
                    <a className="link" href={signupNext}>
                        회원가입
                    </a>
                </div>
            </div>

            <style jsx>{`
                .login-root {
                    display: flex;
                    justify-content: center;
                    padding: 32px;
                }
                .card {
                    width: 100%;
                    max-width: 380px;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
                }
                h2 {
                    margin: 0 0 12px;
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                }
                label {
                    display: block;
                    margin: 10px 0 6px;
                    font-size: 12px;
                    color: #6b7280;
                }
                input {
                    width: 100%;
                    height: 38px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 0 10px;
                    font-size: 13px;
                }
                input:focus {
                    outline: none;
                    border-color: #0d6efd;
                    box-shadow: 0 0 0 1px rgba(13, 110, 253, 0.2);
                }
                .err {
                    margin-top: 10px;
                    color: #b91c1c;
                    font-size: 12px;
                }
                button {
                    cursor: pointer;
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: default;
                }
                button:first-of-type {
                    margin-top: 14px;
                    width: 100%;
                    height: 40px;
                    border-radius: 10px;
                    border: none;
                    background: #111827;
                    color: #ffffff;
                    font-weight: 700;
                }
                .divider {
                    display: flex;
                    align-items: center;
                    margin: 16px 0 12px;
                    font-size: 11px;
                    color: #9ca3af;
                }
                .line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(
                        90deg,
                        transparent,
                        #e5e7eb,
                        transparent
                    );
                }
                .divider-text {
                    padding: 0 8px;
                    white-space: nowrap;
                }
                .google-btn {
                    width: 100%;
                    height: 40px;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 13px;
                    color: #374151;
                    font-weight: 600;
                }
                .google-btn:hover {
                    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
                }
                .google-icon {
                    width: 18px;
                    height: 18px;
                    display: inline-block;
                    background-image: url('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg');
                    background-size: cover;
                    background-position: center;
                }
                .sub {
                    margin-top: 12px;
                    font-size: 12px;
                    color: #6b7280;
                    text-align: center;
                }
                .link {
                    color: #0d6efd;
                    text-decoration: none;
                    font-weight: 700;
                }
                .link:hover {
                    text-decoration: underline;
                }
                @media (max-width: 640px) {
                    .login-root {
                        padding: 20px;
                    }
                    .card {
                        padding: 18px;
                    }
                }
            `}</style>
        </div>
    );
}
