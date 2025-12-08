import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|login|signup|api).*)',
    ],
};

export function middleware(req: NextRequest) {
    const hasConnectSession = !!req.cookies.get('connect_session')?.value;
    const hasJSession = !!req.cookies.get('JSESSIONID')?.value;

    const hasSession = hasConnectSession || hasJSession;

    if (!hasSession) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set(
            'next',
            req.nextUrl.pathname + (req.nextUrl.search || ''),
        );
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}
