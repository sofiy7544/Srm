'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheck,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const tCommon = useTranslations('common');
  const current = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending} aria-label={tCommon('language')}>
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {localeFlags[current]} {localeNames[current]}
          </span>
          <span className="sm:hidden">{localeFlags[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((loc) => (
          <DropdownMenuItem key={loc} onSelect={() => setLocale(loc)}>
            <span className="mr-1">{localeFlags[loc]}</span>
            <span className="flex-1">{localeNames[loc]}</span>
            {loc === current && <DropdownMenuCheck className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
