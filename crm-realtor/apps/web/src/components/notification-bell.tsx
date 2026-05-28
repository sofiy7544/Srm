'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notifications, type NotificationRow } from '@/lib/api';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let interval = 15_000;
    const MAX_INTERVAL = 5 * 60_000;

    const tick = async () => {
      if (cancelled) return;
      try {
        const d = await notifications.unreadCount();
        if (cancelled) return;
        setCount((prev) => {
          if (d.count > prev) interval = 15_000; // new notifications → poll faster
          else interval = Math.min(interval * 1.5, MAX_INTERVAL); // nothing → back off
          return d.count;
        });
      } catch {
        interval = Math.min(interval * 2, MAX_INTERVAL);
      }
      if (!cancelled) timeoutId = setTimeout(tick, interval);
    };

    tick();
    const onFocus = () => {
      if (timeoutId) clearTimeout(timeoutId);
      interval = 15_000;
      tick();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  async function load() {
    const list = await notifications.list();
    setItems(list);
  }

  async function onOpenChange(state: boolean) {
    setOpen(state);
    if (state) await load();
  }

  async function handleClick(n: NotificationRow) {
    if (!n.isRead) {
      await notifications.markRead(n.id);
      setCount((c) => Math.max(0, c - 1));
    }
    if (n.link) router.push(n.link);
    setOpen(false);
  }

  async function markAll() {
    await notifications.markAllRead();
    setCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-3xs font-medium flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[20rem]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{t('title')}</span>
          {count > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void markAll();
              }}
              className="text-xs text-primary hover:underline"
            >
              {t('markAllRead')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-3 py-4 text-center">{t('empty')}</p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => handleClick(n)}
              className={cn('flex flex-col items-start gap-0.5 cursor-pointer', !n.isRead && 'bg-blue-50')}
            >
              <span className="font-medium text-sm">{n.title}</span>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-3xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
