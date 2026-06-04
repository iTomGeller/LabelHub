'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn && pathname !== '/login') {
      router.push('/login');
    }
    if (isLoggedIn && pathname === '/login') {
      router.push('/');
    }
  }, [isLoggedIn, pathname, router]);

  if (!isLoggedIn && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
