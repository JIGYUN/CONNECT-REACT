// filepath: src/app/logout/page.tsx
'use client';

import { useEffect } from 'react';

export default function LogoutPage() {
    useEffect(() => {
        (async () => {
            try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
            window.location.replace('/login');
        })();
    }, []);
    return <div style={{display:'grid',placeItems:'center',minHeight:'100dvh'}}>Logging out…</div>;
}