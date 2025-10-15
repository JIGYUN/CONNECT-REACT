'use client';
import AuthGuard from '@/shared/ui/AuthGuard';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }:{ children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={client}><AuthGuard />{children}</QueryClientProvider>;
}