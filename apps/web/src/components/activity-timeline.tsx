'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone,
  MessageSquare,
  Mail,
  Send,
  Instagram,
  FileText,
  Calendar,
  ArrowRight,
  UserCog,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { activities, type ActivityRow } from '@/lib/api';
import { AudioPlayer } from '@/components/audio-player';
import { formatDate } from '@/lib/formatters';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  TELEGRAM: Send,
  INSTAGRAM: Instagram,
  NOTE: FileText,
  SHOWING: Calendar,
  STAGE_CHANGE: ArrowRight,
  ASSIGNMENT: UserCog,
};

export function ActivityTimeline({
  source,
  id,
}: {
  source: 'client' | 'lead';
  id: string;
}) {
  const t = useTranslations('activity');
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = source === 'client' ? activities.byClient(id) : activities.byLead(id);
    load.then((page) => setItems(page.items)).finally(() => setLoading(false));
  }, [source, id]);

  if (loading) return null;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {items.map((a) => {
            const Icon = ICONS[a.type] ?? FileText;
            return (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{t(`types.${a.type}`, { default: a.type })}</div>
                  {a.content && <div className="text-muted-foreground">{a.content}</div>}
                  {renderMetadata(a, t)}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.user?.fullName ?? '—'} · {formatDate(a.createdAt)}{' '}
                    {new Date(a.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function renderMetadata(a: ActivityRow, t: ReturnType<typeof useTranslations<'activity'>>) {
  if (!a.metadata) return null;
  if (a.type === 'STAGE_CHANGE') {
    const { from, to } = a.metadata as { from?: string; to?: string };
    if (from && to) {
      return (
        <div className="text-xs text-muted-foreground">
          {String(from)} → {String(to)}
        </div>
      );
    }
  }
  if (a.type === 'ASSIGNMENT') {
    const m = a.metadata as { action?: string; from?: string; to?: string; bulk?: boolean };
    if (m.action === 'created') return <div className="text-xs text-muted-foreground">{t('assignedOnCreate')}</div>;
    if (m.bulk) return <div className="text-xs text-muted-foreground">{t('bulkReassigned')}</div>;
  }
  // Голосовая заметка — кастомный AudioPlayer (premium UI), не браузерный <audio>.
  const voice = (a.metadata as { voice?: { audioUrl?: string; durationMs?: number } })?.voice;
  if (voice?.audioUrl) {
    return (
      <div className="mt-1.5">
        <AudioPlayer src={voice.audioUrl} durationMs={voice.durationMs} compact />
      </div>
    );
  }
  return null;
}
