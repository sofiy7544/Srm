'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquare, Send as TgIcon, Mail, Phone, Loader2, Send, Instagram } from 'lucide-react';
import { messages, type ClientDetailed, type MessageRow } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const CHANNELS = [
  { key: 'WHATSAPP',  icon: MessageSquare, color: 'text-emerald-600' },
  { key: 'TELEGRAM',  icon: TgIcon,        color: 'text-sky-600' },
  { key: 'INSTAGRAM', icon: Instagram,     color: 'text-pink-600' },
  { key: 'EMAIL',     icon: Mail,          color: 'text-blue-600' },
  { key: 'PHONE',     icon: Phone,         color: 'text-violet-600' },
] as const;

export function ClientChat({ client }: { client: ClientDetailed }) {
  const t = useTranslations('chat');
  const tChannels = useTranslations('clients.channels');
  const locale = useLocale();
  const dateLocale = locale.replace('_', '-');
  const [channel, setChannel] = useState<string>('WHATSAPP');
  const [list, setList] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function reload() {
    setLoading(true);
    messages
      .list(client.id, channel)
      .then(setList)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    setInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, client.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [list.length]);

  const contact = client.contacts.find((c) => c.channel === channel);
  const placeholder = contact
    ? `${t('messageTo')} ${contact.identifier}`
    : t('noContact');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setInfo(null);
    try {
      const res = await messages.send(client.id, { channel, body: text });
      setText('');
      setInfo(res.delivered ? t('delivered') : res.note ?? t('saved'));
      reload();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden flex flex-col h-[480px] sm:h-[560px]">
      {/* tabs */}
      <div className="border-b glass-strong px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const active = channel === c.key;
          const hasContact = client.contacts.some((cc) => cc.channel === c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChannel(c.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all tracking-tightish',
                active
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', !active && c.color)} />
              {tChannels(c.key)}
              {hasContact && (
                <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white/70' : 'bg-emerald-500')} />
              )}
            </button>
          );
        })}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-muted/10 to-transparent space-y-3">
        {loading && list.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium">{t('empty')}</p>
            <p className="text-xs text-muted-foreground max-w-[260px]">{t('emptyHint')}</p>
          </div>
        ) : (
          list.map((m) => {
            const outgoing = m.activity?.direction === 'OUT';
            return (
              <div
                key={m.id}
                className={cn('flex items-end gap-2', outgoing ? 'flex-row-reverse' : 'flex-row')}
              >
                {!outgoing && <Avatar name={client.fullName} size="xs" />}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-soft tracking-tightish',
                    outgoing
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-white border rounded-bl-md',
                  )}
                >
                  <div className="whitespace-pre-wrap">{m.body ?? ''}</div>
                  <div
                    className={cn(
                      'text-3xs mt-1',
                      outgoing ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground',
                    )}
                  >
                    {new Date(m.createdAt).toLocaleTimeString(dateLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {outgoing && m.deliveredAt ? ' · ✓' : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <form onSubmit={send} className="border-t p-3 bg-surface">
        {info && (
          <div className="mb-2 text-2xs text-muted-foreground px-2">
            {info}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            disabled={!contact || sending}
            className="flex-1 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm tracking-tightish placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-white focus:shadow-glow transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending || !contact}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-soft hover:shadow-glow transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
