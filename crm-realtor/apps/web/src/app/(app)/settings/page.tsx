'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FileText, Plug, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
  const t = useTranslations('settings');

  const items = [
    { href: '/settings/automation', icon: Zap, title: t('automation'), desc: t('automationDesc') },
    { href: '/settings/templates', icon: FileText, title: t('templates'), desc: t('templatesDesc') },
    { href: '/settings/integrations', icon: Plug, title: t('integrations'), desc: t('integrationsDesc') },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="heading-page">{t('title')}</h1>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <Link key={href} href={href}>
            <Card className="p-4 hover:border-primary/50 transition-colors flex items-start gap-3">
              <Icon className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
