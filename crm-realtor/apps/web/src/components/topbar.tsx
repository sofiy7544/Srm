'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
import { NotificationBell } from '@/components/notification-bell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { MobileDrawer } from '@/components/mobile-drawer';
import { useUIStore } from '@/stores/ui-store';

/**
 * New routes are the canonical names; legacy entries kept until Sprint 1.2
 * physically renames the (app)/leads /clients /properties /reports folders.
 */
const TITLE_KEY: Record<string, string> = {
  // canonical
  '/today': 'today',
  '/inbox': 'inbox',
  '/pipeline': 'pipeline',
  '/contacts': 'contacts',
  '/inventory': 'inventory',
  '/calendar': 'calendar',
  '/insights': 'insights',
  '/settings': 'settings',
  '/profile': 'profile',
  // legacy (still rendered while Sprint 1.2 is pending)
  '/dashboard': 'today',
  '/leads': 'pipeline',
  '/deals': 'pipeline',
  '/clients': 'contacts',
  '/properties': 'inventory',
  '/tasks': 'today',
  '/reports': 'insights',
};

export function Topbar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const root = '/' + (pathname.split('/')[1] ?? '');
  const titleKey = TITLE_KEY[root];
  const openQuickCapture = useUIStore((s) => s.openQuickCapture);

  return (
    <header
      className="sticky top-0 z-30 glass-strong px-3 sm:px-6"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex h-14 items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MobileDrawer />
          <h1 className="text-base sm:text-lg font-semibold tracking-tight2 truncate">
            {titleKey ? t(titleKey) : ''}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={openQuickCapture}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 h-9 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-lift transition-all"
            title="Швидке захоплення (Ctrl+Shift+N)"
          >
            <Zap className="h-4 w-4" />
            Захопити лід
          </button>
          {/* Mobile compact button */}
          <button
            type="button"
            onClick={openQuickCapture}
            className="sm:hidden inline-flex items-center justify-center rounded-xl bg-primary h-9 w-9 text-primary-foreground shadow-soft"
            aria-label="Швидке захоплення"
          >
            <Zap className="h-4 w-4" />
          </button>
          <NotificationBell />
          <ThemeToggle />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
