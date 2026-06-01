'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Users,
  Home,
  Inbox,
  KanbanSquare,
  Calendar,
  BarChart3,
  Settings,
  User,
  LogOut,
  Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetCloseIcon, SheetClose } from '@/components/ui/sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

/**
 * Full nav drawer for mobile. Mirrors the new 7-item sidebar plus Settings.
 * Triggered by the hamburger button in the Topbar. The 5-item bottom
 * MobileNav covers most cases — this drawer is the "everything else".
 */
const NAV_ITEMS = [
  { href: '/today', icon: Home, key: 'today' as const },
  { href: '/pool', icon: Inbox, key: 'inbox' as const },
  { href: '/pipeline', icon: KanbanSquare, key: 'pipeline' as const },
  { href: '/contacts', icon: Users, key: 'contacts' as const },
  { href: '/inventory', icon: Building2, key: 'inventory' as const },
  { href: '/calendar', icon: Calendar, key: 'calendar' as const },
  { href: '/insights', icon: BarChart3, key: 'insights' as const },
  { href: '/settings', icon: Settings, key: 'settings' as const },
];

export function MobileDrawer() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await auth.logout();
    setUser(null);
    setOpen(false);
    router.replace('/login');
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="iconSm" className="md:hidden" aria-label="Menu">
          <Menu className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" title="Меню" className="flex flex-col p-0">
        <SheetCloseIcon />
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary-600 to-violet-600 flex items-center justify-center shadow-glow">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-semibold tracking-tight2">MaybSrm</div>
              <div className="text-3xs text-muted-foreground">Premium</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SheetClose key={href} asChild>
                <Link
                  href={href}
                  className={cn(
                    // min-h-touch: 44px WCAG touch target
                    'flex items-center gap-3 rounded-lg px-3 min-h-touch text-sm font-medium transition-all tracking-tightish active:scale-[0.99]',
                    active
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', !active && 'text-muted-foreground')} />
                  <span>{t(key)}</span>
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <div
          className="border-t p-3 space-y-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
        >
          {me && (
            <SheetClose asChild>
              <Link
                href="/profile"
                className="flex items-center gap-2.5 rounded-lg p-2.5 min-h-touch hover:bg-muted transition-colors"
              >
                <Avatar name={me.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{me.email}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    {me.role}
                  </div>
                </div>
                <User className="h-4 w-4 text-muted-foreground" />
              </Link>
            </SheetClose>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-foreground/70 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
