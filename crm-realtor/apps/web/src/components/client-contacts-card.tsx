'use client';

import { useTranslations } from 'next-intl';
import { Phone, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ClientDetailed } from '@/lib/api';

/**
 * Static contacts block shown in place of the messaging composer while internal
 * integrations are disabled (NEXT_PUBLIC_INTEGRATIONS_ENABLED !== 'true').
 * Phone / email are plain tel: / mailto: links — no chat, no channel tabs.
 */
export function ClientContactsCard({ client }: { client: ClientDetailed }) {
  const tNav = useTranslations('nav');
  const hasAny = Boolean(client.primaryPhone || client.email);
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold">{tNav('contacts')}</h3>
      <div className="space-y-2 text-sm">
        {client.primaryPhone && (
          <a
            href={`tel:${client.primaryPhone}`}
            className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4 text-muted-foreground" />
            {client.primaryPhone}
          </a>
        )}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            {client.email}
          </a>
        )}
        {!hasAny && <p className="text-muted-foreground">—</p>}
      </div>
    </Card>
  );
}
