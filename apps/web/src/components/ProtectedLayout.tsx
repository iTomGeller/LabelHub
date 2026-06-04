'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, roleRoutes } from '@/lib/auth';

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const currentRole = useAuthStore(s => s.role);

  useEffect(() => {
    if (!isLoggedIn && pathname !== '/login') {
      router.push('/login');
    }
    if (isLoggedIn && pathname === '/login') {
      router.push(roleRoutes[currentRole]);
    }
    if (isLoggedIn && pathname === '/' && currentRole !== 'OWNER') {
      router.push(roleRoutes[currentRole]);
    }
  }, [isLoggedIn, pathname, currentRole, router]);

  if (!isLoggedIn && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
