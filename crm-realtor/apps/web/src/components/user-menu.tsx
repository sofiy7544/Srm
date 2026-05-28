'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function UserMenu() {
  const t = useTranslations('nav');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!user) {
      auth
        .me()
        .then((u) => setUser({ id: u.id, email: u.email, role: u.role }))
        .catch(() => router.replace('/login'));
    }
  }, [user, setUser, router]);

  async function handleLogout() {
    await auth.logout();
    setUser(null);
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 pl-1 pr-2 sm:pl-2 sm:pr-3">
          <Avatar name={user?.email ?? '?'} size="xs" className="ring-0" />
          <span className="hidden sm:inline max-w-[160px] truncate text-xs">{user?.email ?? '…'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[16rem]">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <Avatar name={user?.email ?? '?'} size="sm" />
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{user?.email}</span>
              <span className="text-3xs text-muted-foreground uppercase tracking-wide">{user?.role}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/profile')}>
          <User className="h-4 w-4" />
          <span>{t('profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
