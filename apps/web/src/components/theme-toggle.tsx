'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Monitor, Moon, MoonStar, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheck,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type Theme } from '@/components/theme-provider';

/**
 * 5 опций темы — в стиле iPhone Display & Brightness:
 *  - light    ☀ — стандартная светлая
 *  - dark     ☾ — стандартная тёмная
 *  - sepia    📖 — тёплая кремовая (как iBooks Reader)
 *  - midnight 🌑 — глубокий чёрный для OLED-экранов
 *  - system   💻 — следовать настройке устройства
 */
const OPTIONS: { value: Theme; labelKey: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', labelKey: 'light', Icon: Sun },
  { value: 'dark', labelKey: 'dark', Icon: Moon },
  { value: 'sepia', labelKey: 'sepia', Icon: BookOpen },
  { value: 'midnight', labelKey: 'midnight', Icon: MoonStar },
  { value: 'system', labelKey: 'system', Icon: Monitor },
];

export function ThemeToggle() {
  const t = useTranslations('theme');
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Иконка в кнопке: визуально отражает текущее разрешённое значение
  const ActiveIcon =
    resolvedTheme === 'midnight'
      ? MoonStar
      : resolvedTheme === 'sepia'
        ? BookOpen
        : resolvedTheme === 'dark'
          ? Moon
          : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('title')}>
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ value, labelKey, Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="flex-1">{t(labelKey)}</span>
            {theme === value && <DropdownMenuCheck className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
