import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import './globals.css';

// Font: system-ui stack — no external fetch needed
const inter = { variable: '' };

export const metadata: Metadata = {
  title: 'MaybSrm',
  description: 'Self-hosted CRM для агентств недвижимости',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  // No-flash скрипт: применяем тему до первого рендера React,
  // чтобы не было «вспышки» светлой темы у пользователя с выбранной тёмной.
  const themeScript = `
    (function () {
      try {
        var stored = localStorage.getItem('crm-theme');
        var allowed = ['light','dark','sepia','midnight','system'];
        var theme = allowed.indexOf(stored) >= 0 ? stored : 'system';
        var resolved = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;
        var isDarkLike = resolved === 'dark' || resolved === 'midnight';
        var root = document.documentElement;
        if (isDarkLike) root.classList.add('dark');
        root.setAttribute('data-theme', resolved);
        root.style.colorScheme = isDarkLike ? 'dark' : 'light';
      } catch (e) {}
    })();
  `;

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Theme bootstrap. suppressHydrationWarning here is essential because
            some browser extensions (BIS, Honey, Grammarly, etc.) wipe or inject
            attributes/scripts in <head>/<body> *before* React hydrates. Without
            this, every refresh logs a hydration mismatch for users with those
            extensions. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
