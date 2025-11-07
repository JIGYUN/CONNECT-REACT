// filepath: src/app/signup/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    apiCheckEmailDuplicate,
    apiSignup,
    type SignupInput,
} from '@/shared/core/auth/api';

type DupState = 'idle' | 'checking' | 'ok' | 'exists' | 'error';

function checkEmail(v: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(v);
}
function checkPw(v: string): boolean {
    if (v.length < 8) return false;
    const hasAlpha = /[A-Za-z]/.test(v);
    const hasNum = /[0-9]/.test(v);
    const hasSpc = /[^A-Za-z0-9]/.test(v);
    const score = (hasAlpha ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpc ? 1 : 0);
    return score >= 2;
}

export default function SignupPage() {
    const params = useSearchParams();

    // 회원가입 완료 후 최종 도착 희망 경로(보호 페이지). 기본 '/'
    // ※ '/login'이나 '/signup'이 들어오면 홈('/')로 정규화
    const targetPath = useMemo(() => {
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

    const [userNm, setUserNm] = useState('');
    const [email, setEmail] = useState('');
    const [telno, setTelno] = useState(''); // (선택값: UI가 없다면 비워둬도 됨)
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');

    const [dupState, setDupState] = useState<DupState>('idle');
    const [dupCheckedEmail, setDupCheckedEmail] = useState<string>(''); // 이 이메일 기준으로 중복 결과 유효
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // 이메일이 바뀌면 중복결과 무효화
    useEffect(() => {
        if (email.trim() !== dupCheckedEmail) setDupState('idle');
    }, [email, dupCheckedEmail]);

    const doDuplicateCheck = async () => {
        const v = email.trim();
        if (!v) { window.alert('이메일을 입력하세요.'); return; }
        if (!checkEmail(v)) { setDupState('error'); setDupCheckedEmail(''); return; }
        setDupState('checking');
        try {
            const r = await apiCheckEmailDuplicate(v);
            setDupState(r.exists ? 'exists' : 'ok');
            setDupCheckedEmail(v);
        } catch {
            setDupState('error');
            setDupCheckedEmail('');
        }
    };

    const canSubmit =
        userNm.trim().length > 0 &&
        checkEmail(email.trim()) &&
        checkPw(password) &&
        password === password2 &&
        dupState === 'ok' &&
        dupCheckedEmail === email.trim();

    const onSubmit = async () => {
        setErr(null);

        const nm = userNm.trim();
        const em = email.trim();
        const pw = password;

        if (!nm) { setErr('이름을 입력하세요.'); return; }
        if (!em || !checkEmail(em)) { setErr('올바른 이메일을 입력하세요.'); return; }
        if (!pw || !checkPw(pw)) { setErr('비밀번호는 8자 이상, 영문/숫자/특수문자 중 2종 이상을 포함하세요.'); return; }
        if (pw !== password2) { setErr('비밀번호가 일치하지 않습니다.'); return; }
        if (!(dupState === 'ok' && dupCheckedEmail === em)) {
            const cont = window.confirm('이메일 중복체크가 완료되지 않았습니다. 계속하시겠습니까?');
            if (!cont) return;
        }

        const payload: SignupInput = {
            email: em,
            userNm: nm,
            password: pw,
            telno: telno.trim() ? telno.trim() : null,
            authType: 'U',
        };

        setSubmitting(true);
        try {
            await apiSignup(payload);
            window.alert('회원가입이 완료되었습니다.');

            // ✅ 회원가입 후에는 로그인 화면으로 이동하되,
            //    최종 도착 희망 경로(targetPath)를 next로 넘긴다.
            const loginRedirect = targetPath === '/'
                ? '/login'
                : `/login?next=${encodeURIComponent(targetPath)}`;
            location.replace(loginRedirect);
        } catch {
            setErr('회원가입 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page">
            <div className="wrap">
                <header className="heading">
                    <h1 className="title">회원가입</h1>
                    <p className="subtitle">간단한 정보만 입력하면 바로 시작할 수 있어요.</p>
                </header>

                <div className="grid">
                    <div className="col">
                        <label htmlFor="userNm">이름</label>
                        <input
                            id="userNm"
                            className="control"
                            value={userNm}
                            onChange={(e) => setUserNm(e.target.value)}
                            placeholder="이름"
                        />
                    </div>
                </div>

                <div className="col-full">
                    <label htmlFor="email">이메일</label>
                    <div className="row-inline">
                        <input
                            id="email"
                            type="email"
                            className="control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => void doDuplicateCheck()}
                            placeholder="example@domain.com"
                        />
                        <button
                            type="button"
                            className="btn-outline"
                            disabled={dupState === 'checking'}
                            onClick={() => void doDuplicateCheck()}
                        >
                            {dupState === 'checking' ? '확인중…' : '중복체크'}
                        </button>
                    </div>
                    <div className={
                        dupState === 'ok' ? 'fb ok'
                        : dupState === 'exists' ? 'fb err'
                        : dupState === 'error' ? 'fb err'
                        : 'fb'
                    }>
                        {dupState === 'ok' && '사용 가능한 이메일입니다.'}
                        {dupState === 'exists' && '이미 사용 중인 이메일입니다.'}
                        {dupState === 'error' && '중복확인 중 오류가 발생했습니다.'}
                    </div>
                    <div className="hint">로그인 ID로 사용됩니다.</div>
                </div>

                <div className="grid">
                    <div className="col">
                        <label htmlFor="pw">비밀번호</label>
                        <input
                            id="pw"
                            type="password"
                            className="control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="8자 이상(영문/숫자/특수문자 2종 이상)"
                        />
                        <div className={
                            password.length === 0 ? 'fb'
                            : checkPw(password) ? 'fb ok'
                            : 'fb warn'
                        }>
                            {password.length === 0 ? '' : checkPw(password) ? '안전한 비밀번호입니다.' : '8자 이상, 영문/숫자/특수문자 2종 이상 권장'}
                        </div>
                    </div>
                    <div className="col">
                        <label htmlFor="pw2">비밀번호 확인</label>
                        <input
                            id="pw2"
                            type="password"
                            className="control"
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            placeholder="비밀번호 확인"
                        />
                        <div className={
                            password2.length === 0 ? 'fb'
                            : password2 === password ? 'fb ok'
                            : 'fb warn'
                        }>
                            {password2.length === 0 ? '' : password2 === password ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                        </div>
                    </div>
                </div>

                {err ? <div className="err">{err}</div> : null}

                <div className="actions">
                    <button
                        className="btn-primary"
                        disabled={submitting || !canSubmit}
                        onClick={() => void onSubmit()}
                    >
                        {submitting ? '회원가입 중…' : '회원가입'}
                    </button>
                    <a className="btn-outline" href="/login">로그인으로</a>
                </div>
            </div>

            <style jsx>{`
                .page {
                    min-height: 100vh;
                    padding: 28px 16px 80px;
                    background:
                        radial-gradient(1200px 420px at -5% -20%, #eef4ff 0%, transparent 45%),
                        linear-gradient(180deg, #ffffff, #f8fafc 60%);
                }
                .wrap {
                    max-width: 880px;
                    margin: 0 auto;
                    padding: 28px 28px 40px;
                    background: #fff;
                    border: 1px solid rgba(0,0,0,.06);
                    border-radius: 18px;
                    box-shadow: 0 8px 30px rgba(0,0,0,.06);
                }
                .heading { padding: 6px 4px 18px; margin-bottom: 18px; }
                .title {
                    margin: 0;
                    font-weight: 800;
                    line-height: 1.15;
                    font-size: clamp(26px, 3.2vw, 34px);
                    background: linear-gradient(90deg, #1d2430, #3a4e85 40%, #7a86ff 70%, #47d9c3 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    letter-spacing: .02em;
                }
                .subtitle { margin: 8px 0 0; color: #6b778c; font-size: .95rem; }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 16px;
                    margin-bottom: 18px;
                }
                .col, .col-full { display: flex; flex-direction: column; }
                .col-full { margin-bottom: 18px; }
                label { font-weight: 600; color: #3d4354; margin-bottom: 6px; }
                .control {
                    height: 48px;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    padding: 0 12px;
                    outline: none;
                }
                .row-inline {
                    display: grid;
                    grid-template-columns: 1fr 120px;
                    gap: 8px;
                }
                .hint { margin-top: 6px; font-size: .86rem; color: #6b778c; }
                .fb { margin-top: 6px; font-size: .86rem; color: #6b778c; }
                .fb.ok { color: #18864b; }
                .fb.warn { color: #b54708; }
                .fb.err { color: #b42318; }
                .err { margin: 8px 0 0; color: #b42318; font-size: .9rem; }

                .actions { display: flex; gap: 12px; margin-top: 14px; }
                .btn-primary {
                    padding: 10px 18px; border-radius: 12px;
                    background: #0d6efd; border: none; color: #fff; font-weight: 800;
                }
                .btn-primary[disabled] { opacity: .6; cursor: not-allowed; }
                .btn-outline {
                    padding: 10px 18px; border-radius: 12px;
                    border: 1px solid #0d6efd; color: #0d6efd; background: transparent;
                    text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
                }

                @media (max-width: 640px) {
                    .grid { grid-template-columns: 1fr; }
                    .row-inline { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
