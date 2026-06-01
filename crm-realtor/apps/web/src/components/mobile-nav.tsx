'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Inbox, KanbanSquare, Calendar, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile bottom navigation — 5 items per dev-prompt §8.2.
 * "More" opens the MobileDrawer (existing component) with full menu.
 *
 * Pinned at safe-area-inset bottom; min 56px tap targets (WCAG 2.5.5).
 */
const ITEMS = [
  { href: '/today', icon: Home, key: 'today' as const },
  { href: '/pool', icon: Inbox, key: 'inbox' as const },
  { href: '/pipeline', icon: KanbanSquare, key: 'pipeline' as const },
  { href: '/calendar', icon: Calendar, key: 'calendar' as const },
] as const;

const LEGACY: Record<string, string> = {
  '/dashboard': '/today',
  '/leads': '/pipeline',
  '/deals': '/pipeline',
};

function isActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  for (const [legacy, canonical] of Object.entries(LEGACY)) {
    if (canonical !== href) continue;
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) return true;
  }
  return false;
}

export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed left-3 right-3 z-50 glass-strong rounded-2xl shadow-lift"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
    >
      <div className="flex items-stretch justify-around px-1 py-1">
        {ITEMS.map(({ href, icon: Icon, key }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={t(key)}
              className={cn(
                'flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 rounded-xl transition-all active:scale-95',
                active
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              <span className="text-3xs font-medium leading-none tracking-tightish truncate max-w-full">
                {t(key)}
              </span>
            </Link>
          );
        })}
        {/* "More" item dispatches the existing drawer via a hidden checkbox/event;
            for now we link to /settings which gives access to the rest. The
            mobile-drawer (existing component) already covers full nav via the
            topbar burger. */}
        <Link
          href="/settings"
          aria-label={t('more')}
          className={cn(
            'flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 rounded-xl transition-all active:scale-95',
            isActive(pathname, '/settings')
              ? 'bg-primary text-primary-foreground shadow-glow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          <span className="text-3xs font-medium leading-none tracking-tightish truncate max-w-full">
            {t('more')}
          </span>
        </Link>
      </div>
    </nav>
  );
}
