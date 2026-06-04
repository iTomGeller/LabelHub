'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, UserRole } from '@/lib/auth';

function getHomePathForRole(role: UserRole): string {
  switch (role) {
    case 'OWNER':
      return '/';
    case 'LABELER':
      return '/tasks';
    case 'REVIEWER':
      return '/review/complete';
    default:
      return '/tasks';
  }
}

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
      router.push(getHomePathForRole(currentRole));
    }
    if (isLoggedIn && pathname === '/' && currentRole !== 'OWNER') {
      router.push(getHomePathForRole(currentRole));
    }
  }, [isLoggedIn, pathname, currentRole, router]);

  if (!isLoggedIn && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
