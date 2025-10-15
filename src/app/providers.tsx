'use client';

import React, { Suspense } from 'react';
import AuthGuard from '@/shared/ui/AuthGuard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => new QueryClient());

    return (
        <QueryClientProvider client={client}>
            <Suspense fallback={null}>
                <AuthGuard />
            </Suspense>
            {children}
        </QueryClientProvider>
    );
}