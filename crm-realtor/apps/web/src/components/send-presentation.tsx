'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Mail, ExternalLink, Send, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clients, presentations, type ClientDetailed } from '@/lib/api';

// Sending the presentation relies on the (disabled) email integration. When off,
// we keep only manual sharing — open the presentation or copy its link.
const INTEGRATIONS_ON = process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED === 'true';

export function SendPresentation({ propertyId }: { propertyId: string }) {
  const t = useTranslations('presentation');
  const [list, setList] = useState<ClientDetailed[]>([]);
  const [clientId, setClientId] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!INTEGRATIONS_ON) return;
    clients.list({ pageSize: 100 }).then((d) => setList(d.items.filter((c) => c.email)));
  }, []);

  async function send() {
    if (!clientId) return;
    setSending(true);
    setInfo(null);
    try {
      await presentations.send(propertyId, clientId);
      setInfo(t('sent'));
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      setInfo(err.payload?.message ?? t('error'));
    } finally {
      setSending(false);
    }
  }

  // Copy the presentation link. HTTP-safe: falls back to execCommand when the
  // async Clipboard API isn't available (it requires a secure context / HTTPS).
  function copyLink() {
    const link = `${window.location.origin}${presentations.url(propertyId)}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        void navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setInfo(t('linkCopied'));
    } catch {
      setInfo(link);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm tracking-tight2">{t('sendToClient')}</h3>
      </div>
      <div className="flex gap-2 flex-wrap">
        {INTEGRATIONS_ON && (
          <>
            <div className="flex-1 min-w-[200px]">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {list.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} · {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={send} disabled={!clientId || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('sendToClient')}
            </Button>
          </>
        )}
        <Button variant="outline" asChild>
          <a href={presentations.url(propertyId)} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            {t('preview')}
          </a>
        </Button>
        <Button variant="outline" onClick={copyLink}>
          <Link2 className="h-4 w-4" />
          {t('copyLink')}
        </Button>
      </div>
      {info && <p className="text-xs text-muted-foreground break-all">{info}</p>}
    </div>
  );
}
