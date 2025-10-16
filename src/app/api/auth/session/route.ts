// filepath: src/app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { setServerSession, clearServerSession, type SessionUser } from '@/shared/core/auth/session';

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.userId !== 'number' || !body.email) {
        return NextResponse.json({ ok: false, msg: 'invalid payload(userId/email)' }, { status: 400 });
    }

    const user: SessionUser = {
        userId: body.userId,
        email: String(body.email),
        name: body.name ?? null,
        authType: 'remote',
        loggedAt: Date.now(),
    };

    await setServerSession(user);
    return NextResponse.json({ ok: true, user });
}

export async function DELETE() {
    await clearServerSession();
    return NextResponse.json({ ok: true });
}