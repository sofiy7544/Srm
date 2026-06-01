'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Home,
  Inbox,
  KanbanSquare,
  Users,
  Calendar,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Sidebar — 7 primary items + settings (per dev-prompt §1.1).
 * Tasks/Deals/Profile are no longer top-level; Tasks live in /today and
 * /calendar, Deals are a stage of /pipeline, Profile lives in the user menu.
 *
 * NOTE: /pipeline /contacts /inventory /insights are server-side redirects to
 * /leads /clients /properties /reports until Sprint 1.2 physically moves the
 * route trees. Keep links pointing at the new (canonical) names so the future
 * rename is transparent to users.
 */
type NavRole = 'all' | 'admin'; // 'admin' = ADMIN or MANAGER

// Reduced from 9 → 6 items (Pipedrive / Attio benchmark).
// "Вхідні" ведёт на /pool — пул нераспределённых лидов (основной экран новых
// заявок). Квалификация unclaimed-контактов живёт отдельно на /qualify.
// Team is reachable from /insights for admins.
const NAV_ITEMS: { href: string; icon: typeof Home; key: string; role: NavRole }[] = [
  { href: '/today', icon: Home, key: 'today', role: 'all' },
  { href: '/pool', icon: Inbox, key: 'inbox', role: 'all' },
  { href: '/pipeline', icon: KanbanSquare, key: 'pipeline', role: 'all' },
  { href: '/contacts', icon: Users, key: 'contacts', role: 'all' },
  { href: '/inventory', icon: Building2, key: 'inventory', role: 'all' },
  { href: '/calendar', icon: Calendar, key: 'calendar', role: 'all' },
  { href: '/insights', icon: BarChart3, key: 'insights', role: 'all' },
];

// Legacy URLs that should still highlight a sidebar item (during the
// transition before Sprint 1.2 physical-rename lands).
const LEGACY_PREFIX_MAP: Record<string, string> = {
  '/dashboard': '/today',
  '/leads': '/pipeline',
  '/deals': '/pipeline',
  '/clients': '/contacts',
  '/properties': '/inventory',
  '/reports': '/insights',
  '/tasks': '/today',
};

function isActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  for (const [legacy, canonical] of Object.entries(LEGACY_PREFIX_MAP)) {
    if (canonical !== href) continue;
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) return true;
  }
  return false;
}

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  return (
    <aside className="hidden md:flex w-[208px] shrink-0 flex-col py-4 pl-4">
      <div className="surface-card flex h-full flex-col py-3 px-2.5">
        <div className="flex h-11 items-center gap-2 px-2.5 mb-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-600 to-violet-600 flex items-center justify-center shadow-glow">
            <Building2 className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight2">MaybSrm</div>
            <div className="text-3xs text-muted-foreground leading-tight">Premium</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.filter((it) => it.role === 'all' || isAdmin).map(({ href, icon: Icon, key }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? '' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                  strokeWidth={1.75}
                />
                <span className="tracking-tightish">{t(key as 'today')}</span>
                {active && (
                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 border-t pt-3 space-y-0.5">
          <Link
            href="/settings"
            className={cn(
              'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all',
              isActive(pathname, '/settings')
                ? 'bg-primary text-primary-foreground shadow-glow'
                : 'text-foreground/70 hover:bg-muted hover:text-foreground',
            )}
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.75} />
            <span className="tracking-tightish">{t('settings')}</span>
          </Link>
          <div className="px-2.5 pt-2 text-3xs text-muted-foreground/70 tracking-wide uppercase">
            v0.7 · self-hosted
          </div>
        </div>
      </div>
    </aside>
  );
}
